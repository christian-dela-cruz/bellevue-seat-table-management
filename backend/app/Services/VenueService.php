<?php

namespace App\Services;

use App\Models\Reservation;
use App\Models\Venue;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

class VenueService
{
    /**
     * Get all venues without pagination (for index page)
     */
    public function getAllVenues(array $filters = []): array
    {
        return Venue::query()
            ->with(['children', 'parent'])
            ->when($filters['type'] ?? null, fn ($query, $type) => $query->where('type', $type))
            ->when($filters['category'] ?? null, fn ($query, $category) => $query->where('category', $category))
            ->when(isset($filters['active']), fn ($query) => $query->where('is_active', filter_var($filters['active'], FILTER_VALIDATE_BOOLEAN)))
            ->when(isset($filters['visible']), fn ($query) => $query->where('is_visible', filter_var($filters['visible'], FILTER_VALIDATE_BOOLEAN)))
            ->when(isset($filters['landing']), fn ($query) => $query->where('show_on_landing', filter_var($filters['landing'], FILTER_VALIDATE_BOOLEAN)))
            ->orderBy('display_order')
            ->orderBy('name')
            ->get()
            ->map(fn (Venue $venue) => $this->formatVenue($venue))
            ->toArray();
    }

    /**
     * Get paginated venues
     */
    public function getPaginatedVenues(int $perPage = 10, int $page = 1): LengthAwarePaginator
    {
        return Venue::paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * Get venue by ID with relationships
     */
    public function getVenueById(int $id): ?Venue
    {
        return Venue::with(['seats', 'reservations'])->find($id);
    }

    /**
     * Create new venue
     */
    public function createVenue(array $data): Venue
    {
        return Venue::create($data);
    }

    /**
     * Update venue
     */
    public function updateVenue(int $id, array $data): ?Venue
    {
        $venue = Venue::find($id);
        if (!$venue) {
            return null;
        }
        
        $venue->update($data);
        return $venue;
    }

    public function formatVenue(Venue $venue): array
    {
        return [
            'id' => $venue->id,
            'parent_id' => $venue->parent_id,
            'name' => $venue->name,
            'slug' => $venue->slug,
            'display_name' => $venue->display_name,
            'wing' => $venue->wing,
            'type' => $venue->type,
            'category' => $venue->category,
            'capacity' => $venue->capacity,
            'price_per_hour' => $venue->price_per_hour,
            'description' => $venue->description,
            'image' => $venue->image,
            'display_order' => $venue->display_order,
            'is_active' => $venue->is_active,
            'is_visible' => $venue->is_visible,
            'show_on_landing' => $venue->show_on_landing,
            'reservations_enabled' => $venue->reservations_enabled,
            'parent_selectable' => $venue->parent_selectable,
            'child_selectable' => $venue->child_selectable,
            'reservation_route' => $venue->reservation_route,
            'image_position' => $venue->image_position,
            'metadata' => $venue->metadata,
            'parent' => $venue->relationLoaded('parent') && $venue->parent ? [
                'id' => $venue->parent->id,
                'name' => $venue->parent->name,
                'display_name' => $venue->parent->display_name,
            ] : null,
            'children' => $venue->relationLoaded('children')
                ? $venue->children->map(fn (Venue $child) => $this->formatVenue($child))->toArray()
                : [],
            'created_at' => $venue->created_at,
            'updated_at' => $venue->updated_at,
        ];
    }

    /**
     * Delete venue
     */
    public function deleteVenue(int $id): bool
    {
        $venue = Venue::find($id);
        if (!$venue) {
            return false;
        }
        
        return $venue->delete();
    }

    /**
     * Get venues by wing
     */
    public function getVenuesByWing(string $wing): array
    {
        return Venue::where('wing', $wing)->get()->toArray();
    }

    /**
     * Get venues by type
     */
    public function getVenuesByType(string $type): array
    {
        return Venue::where('type', $type)->get()->toArray();
    }

    /**
     * Get active venues only
     */
    public function getActiveVenues(): array
    {
        return Venue::where('is_active', true)->get()->toArray();
    }

    public function getAvailabilityByDateRange(?string $startDate = null, ?string $endDate = null): array
    {
        $blockingStatuses = ['pending', 'approved', 'reserved'];

        $venues = Venue::query()
            ->where('is_active', true)
            ->orderBy('wing')
            ->orderBy('name')
            ->get();

        $reservations = Reservation::query()
            ->with('venue')
            ->whereIn('status', $blockingStatuses)
            ->when($startDate, fn ($query) => $query->whereDate('event_date', '>=', $startDate))
            ->when($endDate, fn ($query) => $query->whereDate('event_date', '<=', $endDate))
            ->get();

        $items = $venues->map(function (Venue $venue) use ($reservations) {
            $events = $reservations->where('venue_id', $venue->id)->values();
            $latest = $events->sortBy('event_date')->first();

            return [
                'venue_id' => $venue->id,
                'name' => $venue->name,
                'wing' => $venue->wing,
                'type' => $venue->type,
                'events_count' => $events->count(),
                'pending_count' => $events->where('status', 'pending')->count(),
                'reserved_count' => $events->filter(fn (Reservation $reservation) => in_array($reservation->status, ['reserved', 'approved'], true))->count(),
                'is_available_for_range' => $events->isEmpty(),
                'next_event_date' => $latest?->event_date?->format('Y-m-d'),
                'next_event_time' => $latest?->event_time,
            ];
        })->values();

        return [
            'date_range' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
            'summary' => [
                'outlets' => $items->count(),
                'available' => $items->where('is_available_for_range', true)->count(),
                'with_events' => $items->where('events_count', '>', 0)->count(),
                'events' => $items->sum('events_count'),
            ],
            'data' => $items->toArray(),
        ];
    }

    /**
     * Search venues by name
     */
    public function searchVenues(string $searchTerm): array
    {
        return Venue::where('name', 'like', "%{$searchTerm}%")
            ->orWhere('description', 'like', "%{$searchTerm}%")
            ->get()
            ->toArray();
    }
}
