<?php

namespace App\Http\Controllers;

use App\Models\Venue;
use App\Services\VenueService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Http\Requests\Venue\VenueStoreRequest;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rule;

class VenueController extends Controller
{
    protected VenueService $venueService;

    public function __construct(VenueService $venueService)
    {
        $this->venueService = $venueService;
    }

    /**
     * Get all venues (no pagination for index)
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $venues = $this->venueService->getAllVenues($request->only(['type', 'category', 'active', 'visible', 'landing', 'include_archived']));
            return response()->json($venues);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function availability(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
        ]);

        return response()->json(
            $this->venueService->getAvailabilityByDateRange(
                $validated['start_date'] ?? null,
                $validated['end_date'] ?? null,
            )
        );
    }

    public function timeSlots(Request $request): JsonResponse
    {
        if ($request->filled('room')) {
            $roomName = $request->input('room');
            $selectedVenue = Venue::where('is_active', true)
                ->where('is_archived', false)
                ->where(function ($query) use ($roomName) {
                    $query->where('name', $roomName)
                        ->orWhere('slug', $roomName);
                })
                ->first();
                
            if (!$selectedVenue) {
                // Try case-insensitive matching
                $selectedVenue = Venue::where('is_active', true)
                    ->where('is_archived', false)
                    ->where(function ($query) use ($roomName) {
                        $query->whereRaw('lower(name) = ?', [strtolower(trim($roomName))])
                            ->orWhereRaw('lower(slug) = ?', [strtolower(trim($roomName))]);
                    })
                    ->first();
            }

            if ($selectedVenue) {
                $request->merge(['venue_id' => $selectedVenue->id]);
            }
        } elseif ($request->filled('venue_id')) {
            $venueId = $request->input('venue_id');
            $venue = Venue::find($venueId);
            if (!$venue || !$venue->is_active || $venue->is_archived) {
                if ($venue && !empty($venue->metadata) && is_array($venue->metadata) && isset($venue->metadata['canonical_venue_id'])) {
                    $request->merge(['venue_id' => $venue->metadata['canonical_venue_id']]);
                }
            }
        }

        $validated = $request->validate([
            'venue_id' => ['nullable', 'integer', 'exists:venues,id'],
            'room' => ['nullable', 'string', 'max:255'],
            'date' => ['nullable', 'date'],
            'event_date' => ['nullable', 'date'],
            'guests' => ['nullable', 'integer', 'min:1', 'max:9999'],
        ]);

        $venue = $this->venueService->findVenueForAvailability($validated);
        if (!$venue) {
            return response()->json(['error' => 'Venue not found'], 404);
        }

        return response()->json(
            $this->venueService->getReservationTimeSlots(
                $venue,
                $validated['date'] ?? $validated['event_date'] ?? null,
                (int) ($validated['guests'] ?? 1),
                $validated['room'] ?? null,
            )
        );
    }

    public function availableSubrooms(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['required', 'date'],
            'time' => ['required', 'string'],
            'guests_count' => ['nullable', 'integer', 'min:1'],
            'ignore_reservation_id' => ['nullable', 'integer'],
        ]);

        $parentVenue = Venue::findOrFail($id);

        $available = $this->venueService->getAvailableSubrooms(
            $parentVenue,
            $validated['date'],
            $validated['time'],
            (int) ($validated['guests_count'] ?? 1),
            $validated['ignore_reservation_id'] ?? null
        );

        return response()->json($available);
    }

    /**
     * Get specific venue
     */
    public function show(int $id): JsonResponse
    {
        try {
            $venue = $this->venueService->getVenueById($id);
            
            if (!$venue) {
                return response()->json(['error' => 'Venue not found'], 404);
            }
            
            return response()->json($venue);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Create new venue
     */
    public function store(VenueStoreRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();
            $validated['slug'] = $validated['slug'] ?? Str::slug($validated['name']);
            $validated['display_name'] = $validated['display_name'] ?? $validated['name'];
            $validated['reservation_route'] = $validated['reservation_route'] ?? '/' . $validated['slug'];
            $this->guardParentConfiguration($validated);
            $venue = $this->venueService->createVenue($validated);
            return response()->json($this->venueService->formatVenue($venue->load(['parent', 'children'])), 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Update venue
     */
    public function update(Request $request, int $id): JsonResponse
    {
        try {
            $isDraft = $request->input('is_draft', false);

            $validated = $request->validate([
                'parent_id' => 'sometimes|nullable|exists:venues,id',
                'name' => 'sometimes|required|string|max:255',
                'slug' => ['sometimes', 'nullable', 'string', 'max:255', Rule::unique('venues', 'slug')->ignore($id)->where('is_archived', false)],
                'display_name' => 'sometimes|nullable|string|max:255',
                'wing' => $isDraft ? 'sometimes|nullable|string|max:255' : 'sometimes|required|string|max:255',
                'type' => $isDraft ? 'sometimes|nullable|string|max:255' : 'sometimes|required|string|max:255',
                'category' => 'sometimes|nullable|string|max:255',
                'capacity' => 'sometimes|nullable|integer|min:0',
                'price_per_hour' => 'sometimes|nullable|numeric|min:0',
                'description' => 'sometimes|nullable|string',
                'image' => 'sometimes|nullable|string',
                'display_order' => $isDraft ? 'sometimes|nullable|integer|min:0' : 'sometimes|required|integer|min:0',
                'is_active' => 'sometimes|boolean',
                'is_visible' => 'sometimes|boolean',
                'show_on_landing' => 'sometimes|boolean',
                'reservations_enabled' => 'sometimes|boolean',
                'parent_selectable' => 'sometimes|boolean',
                'child_selectable' => 'sometimes|boolean',
                'reservation_route' => ['sometimes', 'nullable', 'string', 'max:255', 'regex:/^\//'],
                'image_position' => 'sometimes|nullable|string|max:255',
                'metadata' => 'sometimes|nullable|array',
                'is_draft' => 'sometimes|boolean',
            ]);
            if (isset($validated['name']) && !array_key_exists('slug', $validated)) {
                $validated['slug'] = Str::slug($validated['name']);
            }
            if (isset($validated['name']) && !array_key_exists('display_name', $validated)) {
                $validated['display_name'] = $validated['name'];
            }
            if (empty($validated['reservation_route']) && !empty($validated['slug'])) {
                $validated['reservation_route'] = '/' . $validated['slug'];
            }
            if (!$isDraft) {
                $this->guardParentConfiguration($validated, $id);
            }

            $venue = $this->venueService->updateVenue($id, $validated);
            
            if (!$venue) {
                return response()->json(['error' => 'Venue not found'], 404);
            }
            
            return response()->json($this->venueService->formatVenue($venue->load(['parent', 'children'])));
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function uploadImage(Request $request, int $id): JsonResponse
    {
        $venue = Venue::find($id);
        if (!$venue) {
            return response()->json(['error' => 'Venue not found'], 404);
        }

        $validated = $request->validate([
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:4096',
        ]);

        $directory = public_path('images/function-rooms');
        if (!File::exists($directory)) {
            File::makeDirectory($directory, 0755, true);
        }

        $file = $validated['image'];
        $filename = Str::slug($venue->slug ?: $venue->name) . '-' . time() . '.' . $file->getClientOriginalExtension();
        $file->move($directory, $filename);

        $venue->update(['image' => "/images/function-rooms/{$filename}"]);

        return response()->json($this->venueService->formatVenue($venue->fresh(['parent', 'children'])));
    }

    /**
     * Delete venue
     */
    public function destroy(int $id): JsonResponse
    {
        try {
            $success = $this->venueService->deleteVenue($id);
            
            if (!$success) {
                return response()->json(['error' => 'Venue not found'], 404);
            }
            
            return response()->json(null, 204);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get venues by wing
     */
    public function getByWing(string $wing): JsonResponse
    {
        try {
            $venues = $this->venueService->getVenuesByWing($wing);
            return response()->json($venues);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get venues by type
     */
    public function getByType(string $type): JsonResponse
    {
        try {
            $venues = $this->venueService->getVenuesByType($type);
            return response()->json($venues);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Search venues
     */
    public function search(string $term): JsonResponse
    {
        try {
            $venues = $this->venueService->searchVenues($term);
            return response()->json($venues);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    private function guardParentConfiguration(array $data, ?int $venueId = null): void
    {
        $parentId = $data['parent_id'] ?? null;
        if (!$parentId) {
            return;
        }

        if ($venueId && (int) $parentId === (int) $venueId) {
            throw ValidationException::withMessages(['parent_id' => 'A function room cannot be assigned as its own parent.']);
        }

        $cursor = Venue::find($parentId);
        while ($cursor) {
            if ($venueId && (int) $cursor->parent_id === (int) $venueId) {
                throw ValidationException::withMessages(['parent_id' => 'Circular parent room relationships are not allowed.']);
            }
            $cursor = $cursor->parent_id ? Venue::find($cursor->parent_id) : null;
        }
    }
}
