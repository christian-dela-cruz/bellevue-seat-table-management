<?php

namespace App\Services;

use App\Models\Reservation;
use App\Models\ReservationTransaction;
use App\Models\Seat;
use App\Models\Venue;

class ReservationService
{
    /**
     * Create a new reservation with seat assignments
     */
    public function createReservation(array $data): Reservation
    {
        // Generate unique reference code
        $data['reference_code'] = date('Y') . '-' . str_pad(mt_rand(1, 9999), 4, '0', STR_PAD_LEFT);
        $data['status'] = 'pending';
        $data['submitted_at'] = now();

        $reservation = Reservation::create($data);

        // If seats are provided, assign them to the reservation
        if (isset($data['seat_ids']) && is_array($data['seat_ids'])) {
            $this->assignSeatsToReservation($reservation, $data['seat_ids']);
        }

        return $reservation->load(['venue', 'seats']);
    }

    /**
     * Approve a reservation and reserve seats
     */
    public function approveReservation(Reservation $reservation): Reservation
    {
        $fromStatus = $reservation->status;
        $reservation->update(['status' => 'reserved']);

        $reservation = $reservation->fresh(['venue']);

        $this->recordTransaction(
            $reservation,
            'status_changed',
            $fromStatus,
            $reservation->status,
            'Reservation approved and selected seat/table reserved.'
        );

        return $reservation->fresh(['venue']);
    }

    /**
     * Reject a reservation and release seats
     */
    public function rejectReservation(Reservation $reservation, string $reason): Reservation
    {
        $fromStatus = $reservation->status;
        $reservation->update([
            'status' => 'rejected',
            'rejection_reason' => $reason,
        ]);

        $reservation = $reservation->fresh(['venue']);

        $this->recordTransaction(
            $reservation,
            'status_changed',
            $fromStatus,
            $reservation->status,
            'Reservation rejected by admin.',
            ['reason' => $reason]
        );

        return $reservation->fresh(['venue']);
    }

    /**
     * Revert a rejected reservation back to pending review.
     */
    public function revertRejectedReservation(Reservation $reservation): Reservation
    {
        $fromStatus = $reservation->status;
        $reservation->update([
            'status' => 'pending',
        ]);

        $reservation = $reservation->fresh(['venue']);

        $this->recordTransaction(
            $reservation,
            'status_changed',
            $fromStatus,
            $reservation->status,
            'Rejected reservation reverted to pending review.'
        );

        return $reservation->fresh(['venue']);
    }

    public function recordTransaction(
        Reservation $reservation,
        string $action,
        ?string $fromStatus = null,
        ?string $toStatus = null,
        ?string $notes = null,
        array $metadata = []
    ): ReservationTransaction {
        return ReservationTransaction::create([
            'reservation_id' => $reservation->id,
            'action' => $action,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'notes' => $notes,
            'metadata' => $metadata ?: null,
        ]);
    }

    /**
     * Assign seats to a reservation
     */
    private function assignSeatsToReservation(Reservation $reservation, array $seatIds): void
    {
        Seat::whereIn('id', $seatIds)
            ->where('status', 'available')
            ->update([
                'status' => 'reserved',
                'reservation_id' => $reservation->id,
            ]);
    }

    /**
     * Check if seats are available for a given venue and date
     */
    public function checkSeatAvailability(int $venueId, string $date): array
    {
        $totalSeats = Seat::where('venue_id', $venueId)->count();
        $availableSeats = Seat::where('venue_id', $venueId)
            ->where('status', 'available')
            ->count();

        return [
            'total' => $totalSeats,
            'available' => $availableSeats,
            'reserved' => $totalSeats - $availableSeats,
        ];
    }

    public function hasScheduleConflict(array $data, ?int $ignoreReservationId = null): bool
    {
        $tableNumber = trim((string) ($data['table_number'] ?? ''));
        $seatNumber = trim((string) ($data['seat_number'] ?? ''));
        $eventDate = $data['event_date'] ?? null;
        $eventTime = isset($data['event_time']) ? substr((string) $data['event_time'], 0, 5) : null;
        $type = strtolower((string) ($data['type'] ?? 'whole'));
        $isStandalone = $type === 'standalone'
            || filter_var($data['is_standalone'] ?? false, FILTER_VALIDATE_BOOLEAN)
            || strtoupper($tableNumber) === 'STANDALONE';

        if (empty($data['venue_id']) || !$eventDate || !$eventTime || !$tableNumber) {
            return false;
        }

        $query = Reservation::query()
            ->where('venue_id', (int) $data['venue_id'])
            ->whereDate('event_date', $eventDate)
            ->where('event_time', $eventTime)
            ->whereIn('status', ['pending', 'approved', 'reserved']);

        if ($ignoreReservationId) {
            $query->whereKeyNot($ignoreReservationId);
        }

        if ($isStandalone) {
            $seatId = trim((string) ($data['seat_id'] ?? ''));

            return $query
                ->where(function ($conflictQuery) {
                    $conflictQuery->where('type', 'standalone')
                        ->orWhere('is_standalone', true)
                        ->orWhereRaw('UPPER(table_number) = ?', ['STANDALONE']);
                })
                ->when($seatNumber !== '' || $seatId !== '', function ($conflictQuery) use ($seatNumber, $seatId) {
                    $conflictQuery->where(function ($seatQuery) use ($seatNumber, $seatId) {
                        if ($seatNumber !== '') {
                            $seatQuery->where('seat_number', $seatNumber);
                        }

                        if ($seatId !== '') {
                            $seatQuery->orWhere('seat_id', $seatId);
                        }
                    });
                })
                ->exists();
        }

        $requestedSeats = array_filter(array_map('trim', explode(',', $seatNumber)));

        return $query
            ->where('table_number', $tableNumber)
            ->where(function ($conflictQuery) use ($type, $requestedSeats) {
                if ($type === 'whole' || empty($requestedSeats)) {
                    $conflictQuery->whereNotNull('table_number');
                    return;
                }

                $conflictQuery->where('type', 'whole')
                    ->orWhereNull('seat_number');

                foreach ($requestedSeats as $seat) {
                    $conflictQuery->orWhere('seat_number', $seat)
                        ->orWhere('seat_number', 'like', $seat . ',%')
                        ->orWhere('seat_number', 'like', '%,' . $seat)
                        ->orWhere('seat_number', 'like', '%,' . $seat . ',%');
                }
            })
            ->exists();
    }

    /**
     * Get all reservations with venue information (paginated)
     * Sorts by submitted_at desc by default so the most recently submitted
     * reservation always appears first on page 1, regardless of per-page size.
     */
    public function getAllReservationsPaginated(
        int    $page      = 1,
        int    $perPage   = 10,
        string $sort      = 'submitted_at',  // ← was hardcoded to event_date asc
        string $direction = 'desc',
        ?array $admin = null
    ): \Illuminate\Pagination\LengthAwarePaginator {
        return $this->scopedReservationQuery($admin)->with(['venue'])->orderBy($sort, $direction)
            ->paginate($perPage, ['*'], 'page', $page)
            ->through(
                function ($reservation) {
                    $submittedAt = $reservation->submitted_at
                        ? $reservation->submitted_at->format('M j, Y · g:i A')
                        : '';
                    $submittedAt = preg_replace('/\s+/', ' ', $submittedAt);

                    return [
                        'id'               => $reservation->reference_code,
                        'db_id'            => $reservation->id,
                        'reference_code'    => $reservation->reference_code,
                        'name'             => $reservation->name,
                        'email'            => $reservation->email,
                        'phone'            => $reservation->phone,
                        'room'             => $reservation->room ?? ($reservation->venue->name ?? 'Alabang Function Room'),
                        'table_number'      => $reservation->table_number,
                        'seat_number'       => $reservation->seat_number,
                        'guests_count'     => $reservation->guests_count,
                        'event_date'       => $reservation->event_date->format('Y-m-d'),
                        'event_time'       => $reservation->event_time,
                        'event_area'       => $reservation->event_area,
                        'setup_tables'     => $reservation->setup_tables,
                        'setup_chairs'     => $reservation->setup_chairs,
                        'setup_requirements' => $reservation->setup_requirements,
                        'special_requests' => $reservation->special_requests,
                        'status'           => $reservation->status,
                        'reservation_state' => $reservation->reservation_state,
                        'previous_status'  => $reservation->previous_status,
                        'status_last_changed_at' => optional($reservation->status_last_changed_at)->toISOString(),
                        'rejected_at'      => optional($reservation->rejected_at)->toISOString(),
                        'reverted_at'      => optional($reservation->reverted_at)->toISOString(),
                        'transaction_history' => $this->formatTransactionHistory($reservation),
                        'type'             => $reservation->type,
                        'rejection_reason' => $reservation->rejection_reason,
                        'submittedAt'      => $submittedAt,
                        'submittedTimestamp' => $reservation->submitted_at
                            ? $reservation->submitted_at->timestamp
                            : 0,
                        // Aliases for frontend compatibility
                        'table'            => $reservation->table_number,
                        'seat'             => $reservation->seat_number,
                        'guests'           => $reservation->guests_count,
                        'eventDate'        => $reservation->event_date->format('F j, Y'),
                        'eventTime'        => $reservation->event_time,
                        'eventArea'        => $reservation->event_area,
                        'setupTables'      => $reservation->setup_tables,
                        'setupChairs'      => $reservation->setup_chairs,
                        'setupRequirements' => $reservation->setup_requirements,
                        'specialRequests'  => $reservation->special_requests,
                        'rejectionReason'  => $reservation->rejection_reason,
                    ];
                }
            );
    }

    /**
     * Get all reservations with venue information
     */
    public function getAllReservations(): array
    {
        return Reservation::orderBy('submitted_at', 'desc')
            ->get()
            ->map(function ($reservation) {
                return [
                    'id'               => $reservation->reference_code,
                    'name'             => $reservation->name,
                    'email'            => $reservation->email,
                    'phone'            => $reservation->phone,
                    'room'             => $reservation->room ?? 'Alabang Function Room',
                    'table'            => $reservation->table_number,
                    'seat'             => $reservation->seat_number,
                    'guests'           => $reservation->guests_count,
                    'eventDate'        => $reservation->event_date->format('F j, Y'),
                    'eventTime'        => $reservation->event_time,
                    'eventArea'        => $reservation->event_area,
                    'setupTables'      => $reservation->setup_tables,
                    'setupChairs'      => $reservation->setup_chairs,
                    'setupRequirements' => $reservation->setup_requirements,
                    'specialRequests'  => $reservation->special_requests,
                    'status'           => $reservation->status,
                    'reservation_state' => $reservation->reservation_state,
                    'previous_status'  => $reservation->previous_status,
                    'status_last_changed_at' => optional($reservation->status_last_changed_at)->toISOString(),
                    'rejected_at'      => optional($reservation->rejected_at)->toISOString(),
                    'reverted_at'      => optional($reservation->reverted_at)->toISOString(),
                    'transaction_history' => $this->formatTransactionHistory($reservation),
                    'type'             => $reservation->type,
                    'rejectionReason'  => $reservation->rejection_reason,
                    'submittedAt'      => $reservation->submitted_at->format('M j, Y · g:i A'),
                    'submittedTimestamp' => $reservation->submitted_at->timestamp,
                ];
            })
            ->toArray();
    }

    /**
     * Get reservation statistics
     */
    public function getReservationStats(?array $admin = null): array
    {
        $reservations = $this->scopedReservationQuery($admin)->get();

        return [
            'total'    => $reservations->count(),
            'pending'  => $reservations->where('status', 'pending')->count(),
            'approved' => $reservations->where('status', 'reserved')->count(),
            'rejected' => $reservations->where('status', 'rejected')->count(),
            'cancelled' => $reservations->where('status', 'cancelled')->count(),
            'active' => $reservations->where('reservation_state', 'active')->count(),
            'inactive' => $reservations->where('reservation_state', 'inactive')->count(),
        ];
    }

    public function getOutletReports(?array $admin = null, ?string $startDate = null, ?string $endDate = null): array
    {
        $reservations = $this->scopedReservationQuery($admin)
            ->with('venue')
            ->when($startDate, fn ($query) => $query->whereDate('event_date', '>=', $startDate))
            ->when($endDate, fn ($query) => $query->whereDate('event_date', '<=', $endDate))
            ->orderByDesc('event_date')
            ->get();

        $venueQuery = Venue::query()->orderBy('wing')->orderBy('name');
        $this->applyVenueScope($venueQuery, $admin);
        $venues = $venueQuery->get();

        $reports = $venues->map(function (Venue $venue) use ($reservations) {
            $items = $reservations->where('venue_id', $venue->id)->values();
            return $this->formatOutletReport($venue, $items);
        });

        $unmatched = $reservations
            ->filter(fn (Reservation $reservation) => !$reservation->venue_id)
            ->groupBy(fn (Reservation $reservation) => $reservation->room ?: 'Unassigned Outlet')
            ->map(fn ($items, $name) => $this->formatOutletReport(null, $items->values(), $name));

        $allReports = $reports->concat($unmatched)->values();

        return [
            'summary' => [
                'outlets' => $allReports->count(),
                'reservations' => $reservations->count(),
                'guests' => $reservations->sum('guests_count'),
                'pending' => $reservations->where('status', 'pending')->count(),
                'reserved' => $reservations->filter(fn ($reservation) => in_array($reservation->status, ['reserved', 'approved'], true))->count(),
                'rejected' => $reservations->where('status', 'rejected')->count(),
                'cancelled' => $reservations->where('status', 'cancelled')->count(),
                'dine_in' => $reservations->filter(fn (Reservation $reservation) => $this->isDineInReservation($reservation))->count(),
                'promotion_mentions' => $reservations->filter(fn (Reservation $reservation) => $this->hasPromotionMention($reservation))->count(),
            ],
            'status_breakdown' => $this->formatStatusBreakdown($reservations),
            'category_breakdown' => $this->formatCategoryBreakdown($reservations),
            'room_details' => $this->formatRoomDetails($reservations),
            'data' => $allReports->sortByDesc('total_reservations')->values()->toArray(),
        ];
    }

    public function getTransactionReports(?array $admin = null, ?string $startDate = null, ?string $endDate = null): array
    {
        $reservationScope = $this->scopedReservationQuery($admin)->select('id');

        $transactions = ReservationTransaction::query()
            ->with(['reservation.venue'])
            ->whereIn('reservation_id', $reservationScope)
            ->when($startDate, fn ($query) => $query->whereDate('created_at', '>=', $startDate))
            ->when($endDate, fn ($query) => $query->whereDate('created_at', '<=', $endDate))
            ->latest()
            ->get();

        $reservations = $transactions
            ->pluck('reservation')
            ->filter()
            ->unique('id')
            ->values();

        $venueCount = $reservations
            ->filter(fn (Reservation $reservation) => filled($reservation->venue_id))
            ->pluck('venue_id')
            ->unique()
            ->count();

        $unassignedRoomCount = $reservations
            ->filter(fn (Reservation $reservation) => blank($reservation->venue_id))
            ->pluck('room')
            ->filter()
            ->unique()
            ->count();

        return [
            'summary' => [
                'transactions' => $transactions->count(),
                'reservations' => $reservations->count(),
                'outlets' => $venueCount + $unassignedRoomCount,
                'status_changes' => $transactions->where('action', 'status_changed')->count(),
                'approvals' => $transactions->where('to_status', 'reserved')->count(),
                'rejections' => $transactions->where('to_status', 'rejected')->count(),
                'reverts' => $transactions->filter(
                    fn (ReservationTransaction $transaction) => $transaction->from_status === 'rejected'
                        && $transaction->to_status === 'pending'
                )->count(),
                'latest_at' => optional($transactions->first()?->created_at)->toISOString(),
            ],
            'status_breakdown' => [
                'pending' => $transactions->where('to_status', 'pending')->count(),
                'reserved' => $transactions->where('to_status', 'reserved')->count(),
                'rejected' => $transactions->where('to_status', 'rejected')->count(),
                'cancelled' => $transactions->where('to_status', 'cancelled')->count(),
            ],
            'data' => $transactions
                ->map(fn (ReservationTransaction $transaction) => $this->formatTransactionReportRow($transaction))
                ->values()
                ->toArray(),
        ];
    }

    public function getMonthlyReports(?array $admin = null, ?int $year = null): array
    {
        $year = $year ?: (int) now()->year;

        $reservations = $this->scopedReservationQuery($admin)
            ->with('venue')
            ->whereYear('event_date', $year)
            ->orderBy('event_date')
            ->get();

        $months = collect(range(1, 12))->map(function (int $month) use ($reservations, $year) {
            $items = $reservations->filter(
                fn (Reservation $reservation) => (int) $reservation->event_date->format('n') === $month
            )->values();

            $venueCount = $items
                ->filter(fn (Reservation $reservation) => filled($reservation->venue_id))
                ->pluck('venue_id')
                ->unique()
                ->count();
            $unassignedRoomCount = $items
                ->filter(fn (Reservation $reservation) => blank($reservation->venue_id))
                ->pluck('room')
                ->filter()
                ->unique()
                ->count();

            return [
                'month' => sprintf('%d-%02d', $year, $month),
                'month_number' => $month,
                'label' => now()->setDate($year, $month, 1)->format('M'),
                'reservations' => $items->count(),
                'guests' => $items->sum('guests_count'),
                'outlets' => $venueCount + $unassignedRoomCount,
                'promotion_mentions' => $items->filter(fn (Reservation $reservation) => $this->hasPromotionMention($reservation))->count(),
                'dine_in' => $items->filter(fn (Reservation $reservation) => $this->isDineInReservation($reservation))->count(),
                'room_reservations' => $items->reject(fn (Reservation $reservation) => $this->isDineInReservation($reservation))->count(),
                'pending' => $items->where('status', 'pending')->count(),
                'reserved' => $items->filter(fn (Reservation $reservation) => in_array($reservation->status, ['reserved', 'approved'], true))->count(),
                'rejected' => $items->where('status', 'rejected')->count(),
                'cancelled' => $items->where('status', 'cancelled')->count(),
                'status_breakdown' => $this->formatStatusBreakdown($items),
            ];
        });

        $outletSummary = $reservations
            ->groupBy(fn (Reservation $reservation) => $this->roomLabel($reservation))
            ->map(function ($items, string $outlet) {
                return [
                    'outlet' => $outlet,
                    'reservations' => $items->count(),
                    'guests' => $items->sum('guests_count'),
                    'promotion_mentions' => $items->filter(fn (Reservation $reservation) => $this->hasPromotionMention($reservation))->count(),
                    'pending' => $items->where('status', 'pending')->count(),
                    'reserved' => $items->filter(fn (Reservation $reservation) => in_array($reservation->status, ['reserved', 'approved'], true))->count(),
                    'rejected' => $items->where('status', 'rejected')->count(),
                    'cancelled' => $items->where('status', 'cancelled')->count(),
                ];
            })
            ->sortByDesc('reservations')
            ->values();

        $peakMonth = $months->sortByDesc('reservations')->first();

        return [
            'year' => $year,
            'summary' => [
                'reservations' => $reservations->count(),
                'guests' => $reservations->sum('guests_count'),
                'outlets' => $outletSummary->count(),
                'promotion_mentions' => $reservations->filter(fn (Reservation $reservation) => $this->hasPromotionMention($reservation))->count(),
                'pending' => $reservations->where('status', 'pending')->count(),
                'reserved' => $reservations->filter(fn (Reservation $reservation) => in_array($reservation->status, ['reserved', 'approved'], true))->count(),
                'rejected' => $reservations->where('status', 'rejected')->count(),
                'cancelled' => $reservations->where('status', 'cancelled')->count(),
                'peak_month' => $peakMonth['reservations'] > 0 ? $peakMonth['label'] : null,
            ],
            'months' => $months->values()->toArray(),
            'outlets' => $outletSummary->take(8)->values()->toArray(),
        ];
    }

    /**
     * Delete a reservation and release seats
     */
    public function deleteReservation(Reservation $reservation): bool
    {
        return $reservation->delete();
    }

    public function canAccessReservation(?array $admin, Reservation $reservation): bool
    {
        return $this->canAccessVenue($admin, $reservation->venue_id, $reservation->room);
    }

    public function canAccessVenue(?array $admin, ?int $venueId, ?string $room = null): bool
    {
        if (!$admin || $this->hasGlobalReportAccess($admin) || ($admin['scope_type'] ?? 'all') !== 'assigned') {
            return true;
        }

        $scope = $admin['outlet_scope'] ?? [];

        if (!is_array($scope) || empty($scope)) {
            return false;
        }

        $venueIds = array_map('intval', array_filter($scope, 'is_numeric'));
        $roomNames = array_map(fn ($value) => strtolower((string) $value), $scope);

        return in_array((int) $venueId, $venueIds, true)
            || ($room && in_array(strtolower($room), $roomNames, true));
    }

    private function formatTransactionHistory(Reservation $reservation): array
    {
        return $reservation->transactions()
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn (ReservationTransaction $transaction) => [
                'id' => $transaction->id,
                'action' => $transaction->action,
                'from_status' => $transaction->from_status,
                'to_status' => $transaction->to_status,
                'notes' => $transaction->notes,
                'metadata' => $transaction->metadata,
                'created_at' => optional($transaction->created_at)->toISOString(),
            ])
            ->values()
            ->toArray();
    }

    private function formatTransactionReportRow(ReservationTransaction $transaction): array
    {
        $reservation = $transaction->reservation;
        $venue = $reservation?->venue;

        return [
            'id' => $transaction->id,
            'action' => $transaction->action,
            'from_status' => $transaction->from_status,
            'to_status' => $transaction->to_status,
            'notes' => $transaction->notes,
            'metadata' => $transaction->metadata,
            'created_at' => optional($transaction->created_at)->toISOString(),
            'reservation' => [
                'id' => $reservation?->id,
                'reference_code' => $reservation?->reference_code,
                'name' => $reservation?->name,
                'email' => $reservation?->email,
                'status' => $reservation?->status,
                'room' => $reservation?->room ?: $venue?->name,
                'event_date' => $reservation?->event_date?->format('Y-m-d'),
                'event_time' => $reservation?->event_time,
            ],
            'venue' => [
                'id' => $venue?->id,
                'name' => $venue?->name,
                'wing' => $venue?->wing,
                'type' => $venue?->type,
            ],
        ];
    }

    private function scopedReservationQuery(?array $admin)
    {
        $query = Reservation::query();

        if (!$admin || $this->hasGlobalReportAccess($admin) || ($admin['scope_type'] ?? 'all') !== 'assigned') {
            return $query;
        }

        $scope = $admin['outlet_scope'] ?? [];

        if (!is_array($scope) || empty($scope)) {
            return $query->whereRaw('1 = 0');
        }

        $venueIds = array_values(array_filter(array_map(
            fn ($value) => is_numeric($value) ? (int) $value : null,
            $scope
        )));
        $roomNames = array_values(array_filter(array_map(
            fn ($value) => is_numeric($value) ? null : (string) $value,
            $scope
        )));

        return $query->where(function ($scopedQuery) use ($venueIds, $roomNames) {
            if (!empty($venueIds)) {
                $scopedQuery->whereIn('venue_id', $venueIds);
            }

            if (!empty($roomNames)) {
                $method = !empty($venueIds) ? 'orWhereIn' : 'whereIn';
                $scopedQuery->{$method}('room', $roomNames);
            }
        });
    }

    private function applyVenueScope($query, ?array $admin): void
    {
        if (!$admin || $this->hasGlobalReportAccess($admin) || ($admin['scope_type'] ?? 'all') !== 'assigned') {
            return;
        }

        $scope = $admin['outlet_scope'] ?? [];

        if (!is_array($scope) || empty($scope)) {
            $query->whereRaw('1 = 0');
            return;
        }

        $venueIds = array_values(array_filter(array_map(
            fn ($value) => is_numeric($value) ? (int) $value : null,
            $scope
        )));
        $venueNames = array_values(array_filter(array_map(
            fn ($value) => is_numeric($value) ? null : (string) $value,
            $scope
        )));

        $query->where(function ($scopedQuery) use ($venueIds, $venueNames) {
            if (!empty($venueIds)) {
                $scopedQuery->whereIn('id', $venueIds);
            }

            if (!empty($venueNames)) {
                $method = !empty($venueIds) ? 'orWhereIn' : 'whereIn';
                $scopedQuery->{$method}('name', $venueNames);
            }
        });
    }

    private function hasGlobalReportAccess(?array $admin): bool
    {
        return in_array('view_global_reports', $admin['permissions'] ?? [], true);
    }

    private function formatOutletReport(?Venue $venue, $reservations, ?string $fallbackName = null): array
    {
        $total = $reservations->count();
        $reserved = $reservations->filter(fn ($reservation) => in_array($reservation->status, ['reserved', 'approved'], true))->count();
        $pending = $reservations->where('status', 'pending')->count();
        $rejected = $reservations->where('status', 'rejected')->count();
        $cancelled = $reservations->where('status', 'cancelled')->count();
        $active = $reservations->where('reservation_state', 'active')->count();
        $inactive = $reservations->where('reservation_state', 'inactive')->count();
        $latest = $reservations->sortByDesc('event_date')->first();
        $dineIn = $reservations->filter(fn (Reservation $reservation) => $this->isDineInReservation($reservation))->count();
        $promotionMentions = $reservations->filter(fn (Reservation $reservation) => $this->hasPromotionMention($reservation))->count();

        return [
            'venue_id' => $venue?->id,
            'name' => $venue?->name ?? $fallbackName ?? 'Unassigned Outlet',
            'wing' => $venue?->wing ?? null,
            'type' => $venue?->type ?? null,
            'capacity' => $venue?->capacity ?? 0,
            'total_reservations' => $total,
            'pending' => $pending,
            'reserved' => $reserved,
            'rejected' => $rejected,
            'cancelled' => $cancelled,
            'active' => $active,
            'inactive' => $inactive,
            'dine_in' => $dineIn,
            'promotion_mentions' => $promotionMentions,
            'guests' => $reservations->sum('guests_count'),
            'acceptance_rate' => $total > 0 ? round(($reserved / $total) * 100, 1) : 0,
            'latest_event_date' => $latest?->event_date?->format('Y-m-d'),
            'latest_event_time' => $latest?->event_time,
            'status_breakdown' => $this->formatStatusBreakdown($reservations),
            'room_details' => $this->formatRoomDetails($reservations),
        ];
    }

    private function formatStatusBreakdown($reservations): array
    {
        $statuses = ['pending', 'reserved', 'approved', 'rejected', 'cancelled'];

        return collect($statuses)
            ->mapWithKeys(fn (string $status) => [
                $status => $reservations->where('status', $status)->count(),
            ])
            ->toArray();
    }

    private function formatCategoryBreakdown($reservations): array
    {
        $dineIn = $reservations->filter(fn (Reservation $reservation) => $this->isDineInReservation($reservation));
        $roomReservations = $reservations->reject(fn (Reservation $reservation) => $this->isDineInReservation($reservation));
        $promotionMentions = $reservations->filter(fn (Reservation $reservation) => $this->hasPromotionMention($reservation));

        return [
            'dine_in' => [
                'reservations' => $dineIn->count(),
                'guests' => $dineIn->sum('guests_count'),
            ],
            'room_reservations' => [
                'reservations' => $roomReservations->count(),
                'guests' => $roomReservations->sum('guests_count'),
            ],
            'promotion_mentions' => [
                'reservations' => $promotionMentions->count(),
                'guests' => $promotionMentions->sum('guests_count'),
            ],
        ];
    }

    private function formatRoomDetails($reservations): array
    {
        return $reservations
            ->groupBy(fn (Reservation $reservation) => $this->roomLabel($reservation))
            ->map(function ($items, string $room) {
                $latest = $items->sortByDesc('event_date')->first();

                return [
                    'room' => $room,
                    'reservations' => $items->count(),
                    'guests' => $items->sum('guests_count'),
                    'pending' => $items->where('status', 'pending')->count(),
                    'reserved' => $items->filter(fn (Reservation $reservation) => in_array($reservation->status, ['reserved', 'approved'], true))->count(),
                    'rejected' => $items->where('status', 'rejected')->count(),
                    'cancelled' => $items->where('status', 'cancelled')->count(),
                    'dine_in' => $items->filter(fn (Reservation $reservation) => $this->isDineInReservation($reservation))->count(),
                    'promotion_mentions' => $items->filter(fn (Reservation $reservation) => $this->hasPromotionMention($reservation))->count(),
                    'latest_event_date' => $latest?->event_date?->format('Y-m-d'),
                    'latest_event_time' => $latest?->event_time,
                ];
            })
            ->sortByDesc('reservations')
            ->values()
            ->toArray();
    }

    private function isDineInReservation(Reservation $reservation): bool
    {
        $venueType = strtolower((string) ($reservation->venue?->type ?? ''));
        $wing = strtolower((string) ($reservation->venue?->wing ?? ''));

        return str_contains($venueType, 'dining')
            || str_contains($venueType, 'restaurant')
            || str_contains($wing, 'dining');
    }

    private function hasPromotionMention(Reservation $reservation): bool
    {
        $notes = strtolower((string) $reservation->special_requests);

        return str_contains($notes, 'promo')
            || str_contains($notes, 'promotion')
            || str_contains($notes, 'voucher')
            || str_contains($notes, 'discount')
            || str_contains($notes, 'package');
    }

    private function roomLabel(Reservation $reservation): string
    {
        return $reservation->room
            ?: $reservation->venue?->name
            ?: 'Unassigned Room';
    }

    /**
     * Get reservation statistics for a venue
     */
    public function getVenueStats(int $venueId): array
    {
        $reservations = Reservation::where('venue_id', $venueId);

        return [
            'total'    => $reservations->count(),
            'pending'  => $reservations->where('status', 'pending')->count(),
            'approved' => $reservations->where('status', 'approved')->count(),
            'rejected' => $reservations->where('status', 'rejected')->count(),
            'cancelled' => $reservations->where('status', 'cancelled')->count(),
        ];
    }
}
