<?php

namespace App\Services;

use App\Models\Reservation;
use App\Models\Venue;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class VenueService
{
    /**
     * Get all venues without pagination (for index page)
     */
    public function getAllVenues(array $filters = []): array
    {
        $hasArchiveColumn = $this->hasArchiveColumn();
        $includeArchived = filter_var($filters['include_archived'] ?? false, FILTER_VALIDATE_BOOLEAN);

        return Venue::query()
            ->with([
                'children' => function ($query) use ($hasArchiveColumn, $includeArchived) {
                    if ($hasArchiveColumn && !$includeArchived) {
                        $query->where('is_archived', false);
                    }
                },
                'parent',
            ])
            ->when($hasArchiveColumn && !$includeArchived, fn ($query) => $query->where('is_archived', false))
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
        $query = Venue::query();
        $this->withoutArchived($query);

        return $query->paginate($perPage, ['*'], 'page', $page);
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
        $data = $this->normalizeStatePayload($data);
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
        $data = $this->normalizeStatePayload($data);
        $venue->update($data);
        return $venue;
    }

    public function findVenueForAvailability(array $filters = []): ?Venue
    {
        $query = Venue::query()->with(['parent', 'children']);
        $this->withoutArchived($query);

        if (!empty($filters['venue_id'])) {
            return $query->whereKey((int) $filters['venue_id'])->first();
        }

        $room = trim((string) ($filters['room'] ?? ''));
        if ($room === '') {
            return null;
        }

        $normalized = $this->normalizeName($room);
        $venues = $query->get();

        return $venues->first(fn (Venue $venue) => $this->normalizeName($venue->name) === $normalized)
            ?? $venues->first(fn (Venue $venue) => $this->normalizeName($venue->display_name) === $normalized)
            ?? $venues->first(fn (Venue $venue) => str_contains($this->normalizeName($venue->name), $normalized))
            ?? $venues->first(fn (Venue $venue) => str_contains($normalized, $this->normalizeName($venue->name)));
    }

    public function getReservationTimeSlots(Venue $venue, ?string $date, int $requestedGuests = 1, ?string $room = null, ?int $ignoreReservationId = null): array
    {
        $scopeVenue = $venue->parent_id && $venue->parent ? $venue->parent : $venue;
        $configVenue = $venue->parent_id ? $venue : $this->configurationVenueForRoom($venue, $room);
        $config = $this->availabilityConfig($configVenue);
        $dateValue = $date ?: Carbon::today()->format('Y-m-d');
        $selectedDate = Carbon::parse($dateValue)->startOfDay();
        $isVenueReservable = (bool) $configVenue->is_active
            && (bool) ($configVenue->reservations_enabled ?? true)
            && !($configVenue->is_archived ?? false);
        $isVisible = (bool) ($configVenue->is_visible ?? true);
        $isAvailabilityEnabled = (bool) ($config['enabled'] ?? true);
        $dateKey = $selectedDate->format('Y-m-d');
        $overrides = $this->overridesForDate($config, $dateKey);
        $closedOverride = collect($overrides)->first(fn (array $override) => ($override['type'] ?? null) === 'closed');
        $isBlockedDate = in_array($dateKey, $config['blocked_dates'] ?? [], true) || (bool) $closedOverride;
        $periods = $isBlockedDate ? [] : $this->periodsForDate($config, $selectedDate);
        $slots = $this->buildSlots($periods);
        $activeStatuses = ['pending', 'approved', 'reserved'];
        $bookings = Reservation::query()
            ->where('venue_id', $scopeVenue->id)
            ->whereDate('event_date', $dateKey)
            ->whereIn('status', $activeStatuses)
            ->when($ignoreReservationId, fn ($query) => $query->whereKeyNot($ignoreReservationId))
            ->when($room, function ($query) use ($room) {
                $query->where(function ($roomQuery) use ($room) {
                    $roomQuery->where('room', $room)
                        ->orWhere('room', $this->parentNameForChildRoom($room));
                });
            })
            ->get()
            ->groupBy(fn (Reservation $reservation) => substr((string) $reservation->event_time, 0, 5));

        $blockedTimes = $this->blockedTimesForDate($config, $dateKey, $overrides);
        $maxReservations = (int) ($config['max_reservations_per_slot'] ?? 0);
        $slotCapacity = (int) ($config['slot_capacity'] ?? 0);
        $requestedGuests = max(1, $requestedGuests);

        $items = collect($slots)->map(function (array $slot) use ($bookings, $blockedTimes, $overrides, $isVenueReservable, $isVisible, $isAvailabilityEnabled, $isBlockedDate, $maxReservations, $slotCapacity, $requestedGuests, $closedOverride) {
            $time = $slot['time'];
            $slotBookings = $bookings->get($time, collect());
            $bookedReservations = $slotBookings->count();
            $bookedGuests = (int) $slotBookings->sum('guests_count');
            $capacityRule = $this->capacityOverrideForTime($overrides, $time);
            $effectiveMaxReservations = (int) ($capacityRule['max_reservations_per_slot'] ?? $slot['max_reservations_per_slot'] ?? $maxReservations);
            $effectiveSlotCapacity = (int) ($capacityRule['slot_capacity'] ?? $slot['slot_capacity'] ?? $slotCapacity);
            $minGuests = (int) ($slot['min_guests'] ?? 0);
            $maxGuests = (int) ($slot['max_guests'] ?? 0);
            $reasons = [];

            if (!$isVenueReservable) {
                $reasons[] = 'Reservations are disabled for this venue.';
            }
            if (!$isVisible) {
                $reasons[] = 'This venue is hidden from guest reservations.';
            }
            if (!$isAvailabilityEnabled) {
                $reasons[] = 'Reservation scheduling is disabled.';
            }
            if ($isBlockedDate) {
                $reasons[] = $closedOverride['note'] ?? 'This date is closed.';
            }
            if (in_array($time, $blockedTimes, true)) {
                $reasons[] = 'This time is blocked.';
            }
            if ($minGuests > 0 && $requestedGuests < $minGuests) {
                $reasons[] = "Minimum party size is {$minGuests} guests.";
            }
            if ($maxGuests > 0 && $requestedGuests > $maxGuests) {
                $reasons[] = "Maximum party size is {$maxGuests} guests.";
            }
            if ($effectiveMaxReservations > 0 && $bookedReservations >= $effectiveMaxReservations) {
                $reasons[] = 'This time slot is full.';
            }
            if ($effectiveSlotCapacity > 0 && ($bookedGuests + $requestedGuests) > $effectiveSlotCapacity) {
                $reasons[] = 'Guest capacity is full for this time.';
            }

            return [
                'time' => $time,
                'label' => trim(($slot['label'] ? $slot['label'] . ' - ' : '') . Carbon::createFromFormat('H:i', $time)->format('g:i A')),
                'period' => $slot['label'],
                'service_type' => $slot['service_type'],
                'available' => empty($reasons),
                'reason' => $reasons[0] ?? null,
                'reserved_count' => $bookedReservations,
                'reserved_guests' => $bookedGuests,
                'remaining_guests' => $effectiveSlotCapacity > 0 ? max(0, $effectiveSlotCapacity - $bookedGuests) : null,
            ];
        })->values();

        $noSlotsMessage = null;
        if ($items->isEmpty()) {
            $closedOverrideNote = is_array($closedOverride) ? ($closedOverride['note'] ?? null) : null;

            $noSlotsMessage = $closedOverrideNote
                ?: ($isBlockedDate ? 'This date is closed.' : 'This venue is closed on the selected day.');
        }

        return [
            'venue_id' => $venue->id,
            'reservation_scope_venue_id' => $scopeVenue->id,
            'venue_name' => $venue->display_name ?: $venue->name,
            'room' => $room ?: $venue->name,
            'date' => $selectedDate->format('Y-m-d'),
            'config' => $config,
            'periods' => array_values($periods),
            'slots' => $items->toArray(),
            'has_available_slots' => $items->contains('available', true),
            'schedule_enforced' => true,
            'message' => $noSlotsMessage,
        ];
    }

    public function isTimeSlotAvailable(array $data, ?int $ignoreReservationId = null): bool
    {
        $venue = Venue::find($data['venue_id'] ?? null);
        if (!$venue) {
            return false;
        }

        $time = substr((string) ($data['event_time'] ?? ''), 0, 5);
        $slots = $this->getReservationTimeSlots(
            $venue,
            $data['event_date'] ?? null,
            (int) ($data['guests_count'] ?? 1),
            $data['room'] ?? null,
            $ignoreReservationId,
        );

        foreach ($slots['slots'] as $slot) {
            if ($slot['time'] === $time) {
                return (bool) $slot['available'];
            }
        }

        return false;
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
            'is_archived' => $venue->is_archived ?? false,
            'archived_at' => $venue->archived_at,
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
                ? $venue->children
                    ->filter(fn (Venue $child) => !($child->is_archived ?? false))
                    ->map(fn (Venue $child) => $this->formatVenue($child))
                    ->values()
                    ->toArray()
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
        
        if ($this->hasArchiveColumn()) {
            return $venue->update([
                'is_archived' => true,
                'archived_at' => Carbon::now(),
                'is_active' => false,
                'is_visible' => false,
                'show_on_landing' => false,
                'reservations_enabled' => false,
            ]);
        }

        return $venue->update([
            'is_active' => false,
        ]);
    }

    /**
     * Get venues by wing
     */
    public function getVenuesByWing(string $wing): array
    {
        $query = Venue::where('wing', $wing);
        $this->withoutArchived($query);

        return $query->get()->toArray();
    }

    /**
     * Get venues by type
     */
    public function getVenuesByType(string $type): array
    {
        $query = Venue::where('type', $type);
        $this->withoutArchived($query);

        return $query->get()->toArray();
    }

    /**
     * Get active venues only
     */
    public function getActiveVenues(): array
    {
        $query = Venue::where('is_active', true);
        $this->withoutArchived($query);

        return $query->get()->toArray();
    }

    public function getAvailabilityByDateRange(?string $startDate = null, ?string $endDate = null): array
    {
        $blockingStatuses = ['pending', 'approved', 'reserved'];

        $venues = Venue::query()
            ->where('is_active', true)
            ->when($this->hasArchiveColumn(), fn ($query) => $query->where('is_archived', false))
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
        $query = Venue::query()
            ->where(function ($query) use ($searchTerm) {
                $query->where('name', 'like', "%{$searchTerm}%")
                    ->orWhere('description', 'like', "%{$searchTerm}%");
            })
            ->when($this->hasArchiveColumn(), fn ($query) => $query->where('is_archived', false));

        return $query->get()->toArray();
    }

    private function normalizeStatePayload(array $data): array
    {
        if (array_key_exists('is_active', $data) && !$data['is_active']) {
            $data['reservations_enabled'] = false;
        }

        if (array_key_exists('is_visible', $data) && !$data['is_visible']) {
            $data['show_on_landing'] = false;
        }

        if (array_key_exists('show_on_landing', $data) && $data['show_on_landing']) {
            $data['is_visible'] = true;
        }

        if (array_key_exists('reservations_enabled', $data) && $data['reservations_enabled']) {
            $data['is_active'] = true;
        }

        return $data;
    }

    private function hasArchiveColumn(): bool
    {
        return Schema::hasColumn('venues', 'is_archived');
    }

    private function withoutArchived($query): void
    {
        if ($this->hasArchiveColumn()) {
            $query->where('is_archived', false);
        }
    }

    private function availabilityConfig(Venue $venue): array
    {
        $metadata = is_array($venue->metadata) ? $venue->metadata : [];
        $config = is_array($metadata['availability'] ?? null) ? $metadata['availability'] : [];
        $defaults = $this->defaultAvailabilityConfig($venue);
        $merged = array_replace($defaults, array_filter($config, fn ($value) => $value !== null));
        $merged['days'] = array_values(array_map('intval', $merged['days'] ?? range(0, 6)));
        $merged['blocked_dates'] = array_values(array_filter($merged['blocked_dates'] ?? []));
        $merged['blocked_times'] = is_array($merged['blocked_times'] ?? null) ? $merged['blocked_times'] : [];
        $merged['periods'] = $this->normalizeAvailabilityPeriods($merged['periods'] ?? [], $venue, $merged);
        $merged['overrides'] = $this->normalizeAvailabilityOverrides($merged['overrides'] ?? []);
        $merged['interval_minutes'] = max(15, (int) ($merged['interval_minutes'] ?? 30));
        $merged['max_reservations_per_slot'] = max(0, (int) ($merged['max_reservations_per_slot'] ?? 0));
        $merged['slot_capacity'] = max(0, (int) ($merged['slot_capacity'] ?? 0));

        return $merged;
    }

    private function defaultAvailabilityConfig(Venue $venue): array
    {
        $isDining = $venue->type === 'dining';

        return [
            'enabled' => true,
            'days' => range(0, 6),
            'start_time' => $isDining ? '11:00' : '08:00',
            'end_time' => $isDining ? '22:00' : '23:00',
            'interval_minutes' => $isDining ? 30 : 60,
            'max_reservations_per_slot' => 0,
            'slot_capacity' => (int) ($venue->capacity ?? 0),
            'blocked_dates' => [],
            'blocked_times' => [],
            'periods' => $this->defaultAvailabilityPeriods($venue),
            'overrides' => [],
        ];
    }

    private function defaultAvailabilityPeriods(Venue $venue): array
    {
        $capacity = (int) ($venue->capacity ?? 0);
        $name = $this->normalizeName($venue->name);

        if (str_contains($name, 'hanakazu')) {
            return [
                $this->period('Lunch', 'A la carte', [2, 3, 4, 5, 6, 0], '11:30', '14:30', 30, $capacity ?: 81),
                $this->period('Dinner', 'A la carte', [2, 3, 4, 5, 6, 0], '17:30', '22:00', 30, $capacity ?: 81),
            ];
        }

        if (str_contains($name, 'qsina')) {
            return [
                $this->period('Breakfast', 'Breakfast buffet', range(0, 6), '06:00', '10:00', 30, $capacity ?: 80),
                $this->period('Lunch', 'A la carte', [1, 2, 6, 0], '11:30', '14:30', 30, $capacity ?: 80),
                $this->period('Lunch', 'Light lunch buffet', [3, 4, 5], '11:30', '14:30', 30, $capacity ?: 80),
                $this->period('Dinner', 'A la carte', [1, 2, 3, 4], '18:00', '22:00', 30, $capacity ?: 80),
                $this->period('Dinner', 'Dinner buffet', [5, 6, 0], '18:00', '22:00', 30, $capacity ?: 80),
            ];
        }

        if (str_contains($name, 'phoenix')) {
            return [
                $this->period('Lunch', 'Chinese fine dining', range(0, 6), '11:00', '14:30', 30, $capacity ?: 250),
                $this->period('Dinner', 'Chinese fine dining', range(0, 6), '18:00', '22:00', 30, $capacity ?: 250),
            ];
        }

        return [
            $this->period('Event Window', 'Function reservation', range(0, 6), '08:00', '23:00', 60, $capacity),
        ];
    }

    private function period(string $label, string $serviceType, array $days, string $start, string $end, int $interval, int $capacity, int $minGuests = 0, int $maxGuests = 0): array
    {
        return [
            'id' => Str::slug($label . '-' . $serviceType . '-' . $start),
            'label' => $label,
            'service_type' => $serviceType,
            'days' => array_values(array_map('intval', $days)),
            'start_time' => $start,
            'end_time' => $end,
            'interval_minutes' => $interval,
            'max_reservations_per_slot' => 0,
            'slot_capacity' => $capacity,
            'min_guests' => $minGuests,
            'max_guests' => $maxGuests,
            'enabled' => true,
        ];
    }

    private function normalizeAvailabilityPeriods(array $periods, Venue $venue, array $config): array
    {
        if (empty($periods)) {
            $periods = [[
                'label' => $venue->type === 'dining' ? 'Dining Service' : 'Event Window',
                'service_type' => $venue->type === 'dining' ? 'Reservation' : 'Function reservation',
                'days' => $config['days'] ?? range(0, 6),
                'start_time' => $config['start_time'] ?? null,
                'end_time' => $config['end_time'] ?? null,
                'interval_minutes' => $config['interval_minutes'] ?? null,
                'max_reservations_per_slot' => $config['max_reservations_per_slot'] ?? 0,
                'slot_capacity' => $config['slot_capacity'] ?? (int) ($venue->capacity ?? 0),
                'enabled' => true,
            ]];
        }

        return collect($periods)
            ->filter(fn ($period) => is_array($period))
            ->map(function (array $period, int $index) use ($venue) {
                $label = trim((string) ($period['label'] ?? 'Reservation'));
                $serviceType = trim((string) ($period['service_type'] ?? $period['service'] ?? 'Reservation'));

                return [
                    'id' => $period['id'] ?? Str::slug($label . '-' . $index),
                    'label' => $label ?: 'Reservation',
                    'service_type' => $serviceType ?: 'Reservation',
                    'days' => array_values(array_map('intval', $period['days'] ?? range(0, 6))),
                    'start_time' => substr((string) ($period['start_time'] ?? '08:00'), 0, 5),
                    'end_time' => substr((string) ($period['end_time'] ?? '23:00'), 0, 5),
                    'interval_minutes' => max(15, (int) ($period['interval_minutes'] ?? 30)),
                    'max_reservations_per_slot' => max(0, (int) ($period['max_reservations_per_slot'] ?? 0)),
                    'slot_capacity' => max(0, (int) ($period['slot_capacity'] ?? $venue->capacity ?? 0)),
                    'min_guests' => max(0, (int) ($period['min_guests'] ?? 0)),
                    'max_guests' => max(0, (int) ($period['max_guests'] ?? 0)),
                    'enabled' => (bool) ($period['enabled'] ?? true),
                ];
            })
            ->values()
            ->toArray();
    }

    private function normalizeAvailabilityOverrides(array $overrides): array
    {
        return collect($overrides)
            ->filter(fn ($override) => is_array($override) && !empty($override['date']))
            ->map(fn (array $override) => [
                'id' => $override['id'] ?? Str::uuid()->toString(),
                'date' => Carbon::parse($override['date'])->format('Y-m-d'),
                'type' => $override['type'] ?? 'closed',
                'label' => trim((string) ($override['label'] ?? 'Manual override')),
                'start_time' => !empty($override['start_time']) ? substr((string) $override['start_time'], 0, 5) : null,
                'end_time' => !empty($override['end_time']) ? substr((string) $override['end_time'], 0, 5) : null,
                'interval_minutes' => max(15, (int) ($override['interval_minutes'] ?? 30)),
                'blocked_times' => array_values(array_filter(array_map(fn ($time) => substr((string) $time, 0, 5), $override['blocked_times'] ?? []))),
                'slot_capacity' => max(0, (int) ($override['slot_capacity'] ?? 0)),
                'max_reservations_per_slot' => max(0, (int) ($override['max_reservations_per_slot'] ?? 0)),
                'note' => trim((string) ($override['note'] ?? '')),
                'enabled' => (bool) ($override['enabled'] ?? true),
            ])
            ->values()
            ->toArray();
    }

    private function periodsForDate(array $config, Carbon $date): array
    {
        $day = (int) $date->dayOfWeek;
        $periods = collect($config['periods'] ?? [])
            ->filter(fn (array $period) => ($period['enabled'] ?? true) && in_array($day, $period['days'] ?? range(0, 6), true));

        $special = collect($this->overridesForDate($config, $date->format('Y-m-d')))
            ->filter(fn (array $override) => ($override['type'] ?? null) === 'special_hours' && !empty($override['start_time']) && !empty($override['end_time']))
            ->map(fn (array $override) => [
                'id' => $override['id'],
                'label' => $override['label'] ?: 'Special Hours',
                'service_type' => 'Manual override',
                'days' => [$day],
                'start_time' => $override['start_time'],
                'end_time' => $override['end_time'],
                'interval_minutes' => $override['interval_minutes'] ?? 30,
                'max_reservations_per_slot' => $override['max_reservations_per_slot'] ?? 0,
                'slot_capacity' => $override['slot_capacity'] ?? ($config['slot_capacity'] ?? 0),
                'min_guests' => 0,
                'max_guests' => 0,
                'enabled' => true,
            ]);

        return $periods->merge($special)->values()->toArray();
    }

    private function buildSlots(array $periods): array
    {
        $slots = [];
        foreach ($periods as $period) {
            $start = Carbon::createFromFormat('H:i', substr((string) $period['start_time'], 0, 5));
            $end = Carbon::createFromFormat('H:i', substr((string) $period['end_time'], 0, 5));
            $interval = max(15, (int) $period['interval_minutes']);

            if ($end->lessThanOrEqualTo($start)) {
                $end->addDay();
            }

            $cursor = $start->copy();
            while ($cursor->lessThan($end)) {
                $time = $cursor->format('H:i');
                $slots[$time] = [
                    'time' => $time,
                    'label' => $period['label'] ?? 'Reservation',
                    'service_type' => $period['service_type'] ?? 'Reservation',
                    'max_reservations_per_slot' => $period['max_reservations_per_slot'] ?? 0,
                    'slot_capacity' => $period['slot_capacity'] ?? 0,
                    'min_guests' => $period['min_guests'] ?? 0,
                    'max_guests' => $period['max_guests'] ?? 0,
                ];
                $cursor->addMinutes($interval);
            }
        }

        ksort($slots);
        return array_values($slots);
    }

    private function blockedTimesForDate(array $config, string $date, array $overrides = []): array
    {
        $blocked = $config['blocked_times'] ?? [];
        $times = array_merge($blocked['*'] ?? [], $blocked[$date] ?? []);

        foreach ($overrides as $override) {
            if (($override['type'] ?? null) !== 'block_time') {
                continue;
            }

            $times = array_merge($times, $override['blocked_times'] ?? []);
            if (!empty($override['start_time']) && !empty($override['end_time'])) {
                $cursor = Carbon::createFromFormat('H:i', $override['start_time']);
                $end = Carbon::createFromFormat('H:i', $override['end_time']);
                if ($end->lessThanOrEqualTo($cursor)) {
                    $end->addDay();
                }
                while ($cursor->lessThan($end)) {
                    $times[] = $cursor->format('H:i');
                    $cursor->addMinutes((int) ($override['interval_minutes'] ?? 30));
                }
            }
        }

        return array_values(array_unique(array_map(
            fn ($time) => substr((string) $time, 0, 5),
            $times,
        )));
    }

    private function overridesForDate(array $config, string $date): array
    {
        return collect($config['overrides'] ?? [])
            ->filter(fn (array $override) => ($override['enabled'] ?? true) && ($override['date'] ?? null) === $date)
            ->values()
            ->toArray();
    }

    private function capacityOverrideForTime(array $overrides, string $time): array
    {
        foreach ($overrides as $override) {
            if (($override['type'] ?? null) !== 'capacity') {
                continue;
            }

            $start = $override['start_time'] ?? null;
            $end = $override['end_time'] ?? null;
            if (!$start || !$end || ($time >= $start && $time < $end)) {
                return $override;
            }
        }

        return [];
    }

    private function configurationVenueForRoom(Venue $venue, ?string $room): Venue
    {
        if (!$room) {
            return $venue;
        }

        $normalized = $this->normalizeName($room);
        $child = $venue->children->first(fn (Venue $item) => $this->normalizeName($item->name) === $normalized || $this->normalizeName($item->display_name) === $normalized);

        return $child ?: $venue;
    }

    private function normalizeName(?string $value): string
    {
        $value = strtolower((string) $value);
        $value = preg_replace('/\s+/', ' ', $value);
        $value = preg_replace('/[^a-z0-9\/ ]/', '', $value);

        return trim($value ?? '');
    }

    private function parentNameForChildRoom(string $room): string
    {
        $normalized = $this->normalizeName($room);

        if (str_starts_with($normalized, 'laguna ballroom')) {
            return 'Laguna Ballroom';
        }

        if (str_starts_with($normalized, '20/20 function room') || str_starts_with($normalized, '2020 function room')) {
            return '20/20 Function Room';
        }

        if (str_starts_with($normalized, 'grand ballroom')) {
            return 'Grand Ballroom';
        }

        if (str_starts_with($normalized, 'tower ')) {
            return 'Tower Ballroom';
        }

        return $room;
    }
}
