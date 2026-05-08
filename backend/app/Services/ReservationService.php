<?php

namespace App\Services;

use App\Models\Reservation;
use App\Models\ReservationTransaction;
use App\Models\Seat;

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

        // Update the specific seat status if seat_number is specified
        if ($reservation->seat_number) {
            Seat::where('venue_id', $reservation->venue_id)
                ->where('table_number', $reservation->table_number)
                ->where('seat_number', $reservation->seat_number)
                ->update(['status' => 'reserved']);
        }

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

        // Update the specific seat status back to available if seat_number is specified
        if ($reservation->seat_number) {
            Seat::where('venue_id', $reservation->venue_id)
                ->where('table_number', $reservation->table_number)
                ->where('seat_number', $reservation->seat_number)
                ->update(['status' => 'available']);
        }

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
        if (!$admin || ($admin['scope_type'] ?? 'all') !== 'assigned') {
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

    private function scopedReservationQuery(?array $admin)
    {
        $query = Reservation::query();

        if (!$admin || ($admin['scope_type'] ?? 'all') !== 'assigned') {
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
