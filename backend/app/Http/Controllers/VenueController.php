<?php

namespace App\Http\Controllers;

use App\Models\Venue;
use App\Services\VenueService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Http\Requests\Venue\VenueStoreRequest;

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
    public function index(): JsonResponse
    {
        try {
            $venues = $this->venueService->getAllVenues();
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
            $venue = $this->venueService->createVenue($validated);
            return response()->json($venue, 201);
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
            $validated = $request->validate([
                'name' => 'sometimes|required|string|max:255',
                'wing' => 'sometimes|required|string|max:255',
                'type' => 'sometimes|required|string|max:255',
                'capacity' => 'sometimes|required|integer|min:0',
                'price_per_hour' => 'sometimes|nullable|numeric|min:0',
                'description' => 'sometimes|nullable|string',
                'image' => 'sometimes|nullable|string',
                'is_active' => 'sometimes|boolean',
            ]);

            $venue = $this->venueService->updateVenue($id, $validated);
            
            if (!$venue) {
                return response()->json(['error' => 'Venue not found'], 404);
            }
            
            return response()->json($venue);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
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
}
