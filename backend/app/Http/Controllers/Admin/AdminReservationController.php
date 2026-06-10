<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use App\Models\Reservation;
use App\Models\Venue;
use App\Services\ReservationService;
use App\Services\VenueService;
use App\Services\WebsocketBroadcaster;
use App\Events\ReservationCreated;
use App\Events\ReservationUpdated;
use App\Events\ReservationDeleted;
use App\Mail\ReservationStatusMail;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class AdminReservationController extends Controller
{
    protected $reservationService;
    protected $venueService;

    public function __construct(ReservationService $reservationService, VenueService $venueService)
    {
        $this->reservationService = $reservationService;
        $this->venueService = $venueService;
    }

    /**
     * Older SQLite databases still reject reservations.type = standalone.
     * Preserve the standalone flags while using an enum-safe fallback until
     * the schema correction migration has been applied.
     */
    private function normalizeStandaloneReservation(array $data): array
    {
        $isStandalone = ($data['type'] ?? null) === 'standalone'
            || ($data['is_standalone'] ?? false);

        if (!$isStandalone) {
            return $data;
        }

        $data['is_standalone'] = true;
        $data['table_number'] = 'STANDALONE';

        if (DB::getDriverName() === 'sqlite') {
            $data['type'] = 'individual';
        } else {
            $data['type'] = 'standalone';
        }

        return $data;
    }

    public function index(Request $request): JsonResponse
    {
        try {
            $page    = $request->get('page', 1);
            $perPage = $request->get('per_page', 10);

            $allowedSorts = ['created_at', 'updated_at', 'id', 'event_date', 'status'];
            $sort      = in_array($request->get('sort'), $allowedSorts)
                            ? $request->get('sort')
                            : 'created_at';
            $direction = in_array($request->get('direction'), ['asc', 'desc'])
                            ? $request->get('direction')
                            : 'desc';

            $reservations = $this->reservationService
                                 ->getAllReservationsPaginated($page, $perPage, $sort, $direction, $this->currentAdmin($request));

            return response()->json([
                'data' => $reservations->items(),
                'pagination' => [
                    'current_page' => $reservations->currentPage(),
                    'per_page'     => $reservations->perPage(),
                    'total'        => $reservations->total(),
                    'last_page'    => $reservations->lastPage(),
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function getStats(Request $request): JsonResponse
    {
        try {
            $stats = $this->reservationService->getReservationStats($this->currentAdmin($request));
            return response()->json($stats);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $this->resolveAndMergeVenueId($request);

        $validated = $request->validate([
            'name'             => 'required|string|max:255',
            'email'            => 'required|email|max:255',
            'phone'            => 'required|string|max:20',
            'venue_id'         => 'required|exists:venues,id',
            'table_number'     => 'nullable|string|max:255',
            'seat_number'      => 'nullable|string|max:255',
            'guests_count'     => 'required|integer|min:1',
            'event_date'       => 'required|date',
            'event_time'       => 'required|string|max:50',
            'event_area'       => 'nullable|string|max:255',
            'setup_tables'     => 'nullable|integer|min:0|max:999',
            'setup_chairs'     => 'nullable|integer|min:0|max:9999',
            'setup_requirements' => 'nullable|string|max:5000',
            'special_requests' => 'nullable|string',
            'type'             => 'required|in:whole,individual,standalone',
            'is_standalone'    => 'nullable|boolean',
            'seat_id'          => 'nullable|string|max:255',
        ]);

        $validated['reference_code'] = date('Y') . '-' . str_pad(mt_rand(1, 9999), 4, '0', STR_PAD_LEFT);
        $validated['status']         = 'pending';
        $validated['submitted_at']   = now();
        $validated = $this->normalizeStandaloneReservation($validated);

        if (!$this->reservationService->canAccessVenue($this->currentAdmin($request), (int) $validated['venue_id'], $validated['room'] ?? null)) {
            return $this->scopeDeniedResponse();
        }

        if ($this->reservationService->hasScheduleConflict($validated)) {
            return response()->json([
                'success' => false,
                'message' => 'This seat or table is no longer available for the selected schedule. Please choose another option.',
            ], 422);
        }

        $reservation = Reservation::create($validated);

        // Send pending confirmation email to the client
        try {
            Mail::to($reservation->email)
                ->send(new ReservationStatusMail($reservation, 'pending'));
        } catch (\Exception $e) {
            \Log::error('Failed to send pending email: ' . $e->getMessage());
        }

        broadcast(new ReservationCreated($reservation))->toOthers();
        WebsocketBroadcaster::broadcast('reservations', 'ReservationCreated', [
            'reservation' => $reservation
        ]);

        return response()->json($reservation, 201);
    }

    public function show(Reservation $reservation): JsonResponse
    {
        if (!$this->reservationService->canAccessReservation($this->currentAdmin(request()), $reservation)) {
            return $this->scopeDeniedResponse();
        }

        $reservation->load(['venue', 'seats']);
        $data = $reservation->toArray();
        $data['transaction_history'] = $reservation->transactions()
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'action' => $t->action,
                'from_status' => $t->from_status,
                'to_status' => $t->to_status,
                'notes' => $t->notes,
                'metadata' => $t->metadata,
                'actor_admin_id' => $t->actor_admin_id,
                'actor_name' => $t->actor_name,
                'actor_role' => $t->actor_role,
                'actor_email' => $t->actor_email,
                'created_at' => optional($t->created_at)->toISOString(),
            ])
            ->values()
            ->toArray();

        return response()->json($data);
    }

    public function update(Request $request, Reservation $reservation): JsonResponse
    {
        $admin = $this->currentAdmin($request);

        if (!$this->reservationService->canAccessReservation($admin, $reservation)) {
            return $this->scopeDeniedResponse();
        }

        $this->resolveAndMergeVenueId($request);

        $validated = $request->validate([
            'name'             => 'sometimes|required|string|max:255',
            'email'            => 'sometimes|required|email|max:255',
            'phone'            => 'sometimes|required|string|max:20',
            'venue_id'         => 'sometimes|required|exists:venues,id',
            'room'             => 'sometimes|nullable|string|max:255',
            'table_number'     => 'sometimes|nullable|string|max:255',
            'seat_number'      => 'sometimes|nullable|string|max:255',
            'seat_id'          => 'sometimes|nullable|string|max:255',
            'guests_count'     => 'sometimes|required|integer|min:1',
            'event_date'       => 'sometimes|required|date',
            'event_time'       => 'sometimes|required|string|max:50',
            'event_area'       => 'sometimes|nullable|string|max:255',
            'setup_tables'     => 'sometimes|nullable|integer|min:0|max:999',
            'setup_chairs'     => 'sometimes|nullable|integer|min:0|max:9999',
            'setup_requirements' => 'sometimes|nullable|string|max:5000',
            'special_requests' => 'sometimes|nullable|string',
            'type'             => 'sometimes|required|in:whole,individual,standalone',
            'is_standalone'    => 'sometimes|boolean',
            'assigned_room_id' => 'sometimes|nullable|exists:venues,id',
            'assignment_status' => 'sometimes|required|string|in:pending_assignment,auto_assigned,manually_assigned',
        ]);

        $targetVenueId = (int) ($validated['venue_id'] ?? $reservation->venue_id);
        $targetRoom = array_key_exists('room', $validated) ? $validated['room'] : $reservation->room;
        $targetDate = $validated['event_date'] ?? $reservation->event_date;
        $targetTime = $validated['event_time'] ?? $reservation->event_time;
        $targetGuests = (int) ($validated['guests_count'] ?? $reservation->guests_count);

        if (!$this->reservationService->canAccessVenue($admin, $targetVenueId, $targetRoom)) {
            return $this->scopeDeniedResponse();
        }

        if (array_key_exists('assigned_room_id', $validated)) {
            $assignedRoomId = $validated['assigned_room_id'];
            if ($assignedRoomId) {
                $childRoom = Venue::find($assignedRoomId);
                if (!$childRoom) {
                    return response()->json(['success' => false, 'message' => 'The selected subroom does not exist.'], 422);
                }
                if ((int) $childRoom->parent_id !== $targetVenueId) {
                    return response()->json(['success' => false, 'message' => 'The selected subroom does not belong to the selected parent venue.'], 422);
                }
                
                if (!$childRoom->is_active || $childRoom->is_archived || !$childRoom->reservations_enabled) {
                    return response()->json(['success' => false, 'message' => 'The selected subroom is not active or reservable.'], 422);
                }

                if ($childRoom->capacity > 0 && $targetGuests > $childRoom->capacity) {
                    return response()->json(['success' => false, 'message' => "Subroom capacity ({$childRoom->capacity}) is too small for {$targetGuests} guests."], 422);
                }

                $parentVenue = Venue::find($targetVenueId);
                $availableSubrooms = $this->venueService->getAvailableSubrooms(
                    $parentVenue,
                    $targetDate instanceof \DateTimeInterface ? $targetDate->format('Y-m-d') : $targetDate,
                    $targetTime,
                    $targetGuests,
                    $reservation->id
                );
                
                $isAvailable = collect($availableSubrooms)->contains(fn ($sub) => (int) ($sub['id'] ?? $sub->id) === (int) $assignedRoomId);
                if (!$isAvailable) {
                    return response()->json(['success' => false, 'message' => 'The selected subroom is already booked or unavailable for this schedule.'], 422);
                }
                
                $validated['assigned_room_id'] = $childRoom->id;
                $validated['internal_room_name'] = $childRoom->name;
                $validated['assignment_status'] = 'manually_assigned';
            } else {
                $validated['assigned_room_id'] = null;
                $validated['internal_room_name'] = null;
                $validated['assignment_status'] = 'pending_assignment';
            }
        }

        $merged = array_merge($reservation->only([
            'venue_id',
            'room',
            'table_number',
            'seat_number',
            'event_date',
            'event_time',
            'type',
            'is_standalone',
            'assigned_room_id',
        ]), $validated);

        if ($this->reservationService->hasScheduleConflict($merged, $reservation->id)) {
            return response()->json([
                'success' => false,
                'message' => 'This seat or table is no longer available for the selected schedule. Please choose another option.',
            ], 422);
        }

        $validated = $this->normalizeStandaloneReservation($validated);

        $original = $reservation->only(array_keys($validated));
        $reservation->update($validated);
        $reservation = $reservation->fresh(['venue']);

        $changes = [];
        foreach ($validated as $field => $value) {
            $before = $original[$field] ?? null;
            $after = $reservation->{$field};

            if ($before instanceof \DateTimeInterface) {
                $before = $before->format('Y-m-d');
            }

            if ($after instanceof \DateTimeInterface) {
                $after = $after->format('Y-m-d');
            }

            if ((string) $before !== (string) $after) {
                $changes[$field] = [
                    'from' => $before,
                    'to' => $after,
                ];
            }
        }

        if (!empty($changes)) {
            $roomChanges = array_intersect_key($changes, array_flip(['assigned_room_id', 'room', 'internal_room_name', 'public_room_name']));
            $seatChanges = array_intersect_key($changes, array_flip(['table_number', 'seat_number', 'seat_id']));
            $guestChanges = array_intersect_key($changes, array_flip(['name', 'email', 'phone']));
            $genericChanges = array_diff_key($changes, array_flip(array_merge(['assigned_room_id', 'room', 'internal_room_name', 'public_room_name', 'table_number', 'seat_number', 'seat_id', 'name', 'email', 'phone'])));

            if (!empty($roomChanges)) {
                $isNewAssignment = empty($original['assigned_room_id']) && empty($original['room']);
                $actionType = $isNewAssignment ? 'room_assigned' : 'room_changed';
                
                $this->reservationService->recordTransaction(
                    $reservation,
                    $actionType,
                    $reservation->status,
                    $reservation->status,
                    $isNewAssignment ? 'Room/outlet assigned by admin.' : 'Assigned room/outlet changed by admin.',
                    [
                        'changes' => $roomChanges,
                        'updated_by' => $admin['username'] ?? $admin['email'] ?? null,
                    ],
                    $admin
                );
            }

            if (!empty($seatChanges)) {
                $this->reservationService->recordTransaction(
                    $reservation,
                    'table_seat_changed',
                    $reservation->status,
                    $reservation->status,
                    'Table or seat assignments updated by admin.',
                    [
                        'changes' => $seatChanges,
                        'updated_by' => $admin['username'] ?? $admin['email'] ?? null,
                    ],
                    $admin
                );
            }

            if (!empty($guestChanges)) {
                $this->reservationService->recordTransaction(
                    $reservation,
                    'guest_details_updated',
                    $reservation->status,
                    $reservation->status,
                    'Guest contact details updated by admin.',
                    [
                        'changes' => $guestChanges,
                        'updated_by' => $admin['username'] ?? $admin['email'] ?? null,
                    ],
                    $admin
                );
            }

            if (!empty($genericChanges)) {
                $this->reservationService->recordTransaction(
                    $reservation,
                    'edited',
                    $reservation->status,
                    $reservation->status,
                    'Reservation details edited by admin.',
                    [
                        'changes' => $genericChanges,
                        'updated_by' => $admin['username'] ?? $admin['email'] ?? null,
                    ],
                    $admin
                );
            }
        }

        broadcast(new ReservationUpdated($reservation))->toOthers();
        WebsocketBroadcaster::broadcast('reservations', 'ReservationUpdated', [
            'reservation' => $reservation
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reservation details updated successfully',
            'reservation' => $reservation,
            'transaction_history' => $reservation->transactions()->latest()->limit(8)->get(),
        ]);
    }

    public function updatePricing(Request $request, int $id): JsonResponse
    {
        $reservation = Reservation::findOrFail($id);
        $admin = $this->currentAdmin($request);

        if (!$this->reservationService->canAccessReservation($admin, $reservation)) {
            return $this->scopeDeniedResponse();
        }

        $validated = $request->validate([
            'pricing_mode' => 'nullable|string|in:fixed,per_person,per_seat,package,custom',
            'base_price' => 'nullable|numeric|min:0',
            'price_per_person' => 'nullable|numeric|min:0',
            'price_per_seat' => 'nullable|numeric|min:0',
            'package_name' => 'nullable|string',
            'package_price' => 'nullable|numeric|min:0',
            'calculated_price' => 'nullable|numeric|min:0',
            'manual_price_override' => 'nullable|numeric|min:0',
            'final_price' => 'nullable|numeric|min:0',
            'price_notes' => 'nullable|string',
            'show_price_to_guest' => 'boolean',
        ]);

        $original = $reservation->getOriginal();

        $reservation->fill($validated);
        $reservation->pricing_updated_by = $admin['id'] ?? null;
        $reservation->pricing_updated_at = now();
        $reservation->save();

        $changes = [];
        foreach ($validated as $field => $value) {
            $before = $original[$field] ?? null;
            $after = $reservation->{$field};

            if ((string) $before !== (string) $after) {
                $changes[$field] = [
                    'from' => $before,
                    'to' => $after,
                ];
            }
        }

        if (!empty($changes)) {
            $this->reservationService->recordTransaction(
                $reservation,
                'pricing_updated',
                $reservation->status,
                $reservation->status,
                'Internal pricing updated by admin.',
                [
                    'changes' => $changes,
                    'updated_by' => $admin['username'] ?? $admin['email'] ?? null,
                ],
                $admin
            );
        }

        broadcast(new ReservationUpdated($reservation))->toOthers();
        WebsocketBroadcaster::broadcast('reservations', 'ReservationUpdated', [
            'reservation' => $reservation
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pricing details updated successfully',
            'reservation' => $reservation,
            'transaction_history' => $reservation->transactions()->latest()->limit(8)->get(),
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        try {
            $reservation = Reservation::where('id', $id)->first();
            if (!$reservation) {
                $reservation = Reservation::where('reference_code', $id)->firstOrFail();
            }

            if (!$this->reservationService->canAccessReservation($this->currentAdmin(request()), $reservation)) {
                return $this->scopeDeniedResponse();
            }

            $this->reservationService->deleteReservation($reservation);

            broadcast(new ReservationDeleted($id))->toOthers();
            WebsocketBroadcaster::broadcast('reservations', 'ReservationDeleted', [
                'id' => $id
            ]);

            return response()->json([
                'success'        => true,
                'message'        => 'Reservation deleted successfully',
                'reservation_id' => $id
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function getVenueReservations(Venue $venue): JsonResponse
    {
        $reservations = $venue->reservations()
            ->with(['seats'])
            ->orderBy('event_date', 'asc')
            ->get();

        return response()->json($reservations);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        \Log::info('AdminReservationController::approve called for reservation ID: ' . $id);
        
        try {
            $reservation = Reservation::findOrFail($id);
            \Log::info('Reservation found: ' . $reservation->email . ', status: ' . $reservation->status);
            $admin = $this->currentAdmin($request);

            if (!$this->reservationService->canAccessReservation($admin, $reservation)) {
                return $this->scopeDeniedResponse();
            }

            if ($this->reservationService->hasScheduleConflict([
                'venue_id' => $reservation->venue_id,
                'room' => $reservation->room,
                'table_number' => $reservation->table_number,
                'seat_number' => $reservation->seat_number,
                'seat_id' => $reservation->seat_id,
                'event_date' => optional($reservation->event_date)->format('Y-m-d'),
                'event_time' => (string) $reservation->event_time,
                'type' => $reservation->type,
                'is_standalone' => $reservation->is_standalone,
            ], $reservation->id)) {
                return response()->json([
                    'success' => false,
                    'message' => 'This reservation can no longer be approved because the selected seat or table is already held or reserved for that date and time.',
                ], 422);
            }
            
            $reservation = $this->reservationService->approveReservation($reservation, $admin);
            \Log::info('Reservation approved, sending email to: ' . $reservation->email);

            // Send approval email to the client
            try {
                Mail::to($reservation->email)
                    ->send(new ReservationStatusMail($reservation, 'reserved'));
                \Log::info('Approval email sent successfully to: ' . $reservation->email);
                $this->reservationService->recordTransaction(
                    $reservation,
                    'notification_sent',
                    $reservation->status,
                    $reservation->status,
                    'Confirmation email sent to guest.',
                    ['channel' => 'email', 'type' => 'reservation_confirmed'],
                    $admin
                );
            } catch (\Exception $e) {
                \Log::error('Failed to send approval email: ' . $e->getMessage());
                $this->reservationService->recordTransaction(
                    $reservation,
                    'notification_failed',
                    $reservation->status,
                    $reservation->status,
                    'Confirmation email failed to send.',
                    ['channel' => 'email', 'type' => 'reservation_confirmed', 'error' => $e->getMessage()],
                    $admin
                );
            }

            try {
                broadcast(new ReservationUpdated($reservation))->toOthers();
                WebsocketBroadcaster::broadcast('reservations', 'ReservationUpdated', [
                    'reservation' => $reservation
                ]);
            } catch (\Throwable $broadcastError) {
                \Log::warning('Reservation approve broadcast failed: ' . $broadcastError->getMessage());
            }

            return response()->json([
                'success'        => true,
                'message'        => 'Reservation approved successfully',
                'reservation_id' => $reservation->reference_code,
                'status'         => $reservation->status,
                'reservation_state' => $reservation->reservation_state,
                'previous_status' => $reservation->previous_status,
                'status_last_changed_at' => optional($reservation->status_last_changed_at)->toISOString(),
                'transaction_history' => $reservation->transactions()->latest()->limit(8)->get(),
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        \Log::info('AdminReservationController::reject called for reservation ID: ' . $id);
        
        try {
            $validated = $request->validate([
                'reason' => 'required|string|min:5|max:1000',
            ]);

            $reservation = Reservation::findOrFail($id);
            \Log::info('Reservation found: ' . $reservation->email . ', status: ' . $reservation->status);

            if (!$this->reservationService->canAccessReservation($this->currentAdmin($request), $reservation)) {
                return $this->scopeDeniedResponse();
            }

            if ($reservation->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only pending reservations can be rejected.',
                ], 422);
            }
            
            $admin = $this->currentAdmin($request);
            $reservation = $this->reservationService->rejectReservation($reservation, $validated['reason'], $admin);
            \Log::info('Reservation rejected, sending email to: ' . $reservation->email . ' with reason: ' . $validated['reason']);

            // Send rejection email to the client
            try {
                Mail::to($reservation->email)
                    ->send(new ReservationStatusMail($reservation, 'rejected', $validated['reason']));
                \Log::info('Rejection email sent successfully to: ' . $reservation->email);
                $this->reservationService->recordTransaction(
                    $reservation,
                    'notification_sent',
                    $reservation->status,
                    $reservation->status,
                    'Rejection email sent to guest.',
                    ['channel' => 'email', 'type' => 'reservation_rejected'],
                    $admin
                );
            } catch (\Exception $e) {
                \Log::error('Failed to send rejection email: ' . $e->getMessage());
                $this->reservationService->recordTransaction(
                    $reservation,
                    'notification_failed',
                    $reservation->status,
                    $reservation->status,
                    'Rejection email failed to send.',
                    ['channel' => 'email', 'type' => 'reservation_rejected', 'error' => $e->getMessage()],
                    $admin
                );
            }

            try {
                broadcast(new ReservationUpdated($reservation))->toOthers();
                WebsocketBroadcaster::broadcast('reservations', 'ReservationUpdated', [
                    'reservation' => $reservation
                ]);
            } catch (\Throwable $broadcastError) {
                \Log::warning('Reservation reject broadcast failed: ' . $broadcastError->getMessage());
            }

            return response()->json([
                'success'        => true,
                'message'        => 'Reservation rejected successfully',
                'reservation_id' => $reservation->reference_code,
                'status'         => $reservation->status,
                'reservation_state' => $reservation->reservation_state,
                'rejection_reason' => $reservation->rejection_reason,
                'previous_status' => $reservation->previous_status,
                'status_last_changed_at' => optional($reservation->status_last_changed_at)->toISOString(),
                'rejected_at' => optional($reservation->rejected_at)->toISOString(),
                'transaction_history' => $reservation->transactions()->latest()->limit(8)->get(),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function revert(int $id): JsonResponse
    {
        \Log::info('AdminReservationController::revert called for reservation ID: ' . $id);

        try {
            $reservation = Reservation::findOrFail($id);

            if (!$this->reservationService->canAccessReservation($this->currentAdmin(request()), $reservation)) {
                return $this->scopeDeniedResponse();
            }

            if ($reservation->status !== 'rejected') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only rejected reservations can be reverted.',
                ], 422);
            }

            $reservation = $this->reservationService->revertRejectedReservation($reservation, $this->currentAdmin(request()));

            try {
                broadcast(new ReservationUpdated($reservation))->toOthers();
                WebsocketBroadcaster::broadcast('reservations', 'ReservationUpdated', [
                    'reservation' => $reservation
                ]);
            } catch (\Throwable $broadcastError) {
                \Log::warning('Reservation revert broadcast failed: ' . $broadcastError->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Reservation reverted to pending successfully',
                'reservation_id' => $reservation->reference_code,
                'status' => $reservation->status,
                'reservation_state' => $reservation->reservation_state,
                'previous_status' => $reservation->previous_status,
                'status_last_changed_at' => optional($reservation->status_last_changed_at)->toISOString(),
                'reverted_at' => optional($reservation->reverted_at)->toISOString(),
                'transaction_history' => $reservation->transactions()->latest()->limit(8)->get(),
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        try {
            $validated = $request->validate([
                'reason' => 'required|string|min:3|max:2000',
            ]);

            $reservation = Reservation::findOrFail($id);
            $admin = $this->currentAdmin($request);

            if (!$this->reservationService->canAccessReservation($admin, $reservation)) {
                return $this->scopeDeniedResponse();
            }

            if (!in_array($reservation->status, ['pending', 'approved', 'reserved'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Only pending, approved, or reserved reservations can be cancelled.',
                ], 422);
            }

            $reservation = $this->reservationService->cancelReservation($reservation, $validated['reason'], $admin);

            // Send cancellation email to the client
            try {
                Mail::to($reservation->email)
                    ->send(new ReservationStatusMail($reservation, 'cancelled', $validated['reason']));
                $this->reservationService->recordTransaction(
                    $reservation,
                    'notification_sent',
                    $reservation->status,
                    $reservation->status,
                    'Cancellation email sent to guest.',
                    ['channel' => 'email', 'type' => 'reservation_cancelled_by_admin'],
                    $admin
                );
            } catch (\Exception $e) {
                \Log::error('Failed to send cancellation email: ' . $e->getMessage());
                $this->reservationService->recordTransaction(
                    $reservation,
                    'notification_failed',
                    $reservation->status,
                    $reservation->status,
                    'Cancellation email failed to send.',
                    ['channel' => 'email', 'type' => 'reservation_cancelled_by_admin', 'error' => $e->getMessage()],
                    $admin
                );
            }

            try {
                broadcast(new ReservationUpdated($reservation))->toOthers();
                WebsocketBroadcaster::broadcast('reservations', 'ReservationUpdated', [
                    'reservation' => $reservation
                ]);
            } catch (\Throwable $broadcastError) {
                \Log::warning('Reservation cancel broadcast failed: ' . $broadcastError->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Reservation cancelled successfully',
                'reservation_id' => $reservation->reference_code,
                'status' => $reservation->status,
                'reservation_state' => $reservation->reservation_state,
                'cancellation_reason' => $reservation->cancellation_reason,
                'cancelled_at' => optional($reservation->cancelled_at)->toISOString(),
                'transaction_history' => $reservation->transactions()->latest()->limit(8)->get(),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function updateCoordination(Request $request, Reservation $reservation): JsonResponse
    {
        $admin = $this->currentAdmin($request);

        if (!$this->reservationService->canAccessReservation($admin, $reservation)) {
            return $this->scopeDeniedResponse();
        }

        $validated = $request->validate([
            'assigned_admin_id' => 'nullable|exists:admins,id',
            'assigned_handler_name' => 'nullable|string|max:255',
            'coordination_status' => 'nullable|in:unassigned,assigned,in_review,awaiting_outlet,awaiting_supervisor,handled,closed',
            'internal_notes' => 'nullable|string|max:5000',
            'handoff_notes' => 'nullable|string|max:5000',
            'activity_note' => 'nullable|string|max:1000',
        ]);

        if (!empty($validated['assigned_admin_id']) && empty($validated['assigned_handler_name'])) {
            $assignedAdmin = Admin::find($validated['assigned_admin_id']);
            $validated['assigned_handler_name'] = $assignedAdmin?->name
                ?: $assignedAdmin?->username
                ?: $assignedAdmin?->email;
        }

        $reservation = $this->reservationService->updateCoordination($reservation, $validated, $admin);

        try {
            broadcast(new ReservationUpdated($reservation))->toOthers();
            WebsocketBroadcaster::broadcast('reservations', 'ReservationUpdated', [
                'reservation' => $reservation,
                'coordination' => true,
            ]);
        } catch (\Throwable $broadcastError) {
            \Log::warning('Reservation coordination broadcast failed: ' . $broadcastError->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Reservation coordination updated successfully',
            'reservation' => $reservation,
            'transaction_history' => $reservation->transactions()->latest()->limit(8)->get(),
        ]);
    }

    public function markSeen(Request $request, Reservation $reservation): JsonResponse
    {
        $admin = $this->currentAdmin($request);

        if (!$this->reservationService->canAccessReservation($admin, $reservation)) {
            return $this->scopeDeniedResponse();
        }

        $reservation = $this->reservationService->markSeen($reservation, $admin);

        try {
            WebsocketBroadcaster::broadcast('reservations', 'ReservationUpdated', [
                'reservation' => $reservation,
                'seen' => true,
            ]);
        } catch (\Throwable $broadcastError) {
            \Log::warning('Reservation seen broadcast failed: ' . $broadcastError->getMessage());
        }

        return response()->json([
            'success' => true,
            'reservation' => $reservation,
            'seen_by' => $reservation->seen_by,
        ]);
    }

    public function acknowledgments(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->reservationService->notificationAcknowledgments($this->currentAdmin($request)),
        ]);
    }

    public function acknowledgeNotification(Request $request): JsonResponse
    {
        $admin = $this->currentAdmin($request);
        $validated = $request->validate([
            'items' => 'nullable|array',
            'items.*.reservation_id' => 'nullable|exists:reservations,id',
            'items.*.notification_key' => 'nullable|string|max:255',
            'items.*.outlet' => 'nullable|string|max:255',
            'items.*.event_date' => 'nullable|date',
            'items.*.event_time' => 'nullable|string|max:50',
            'items.*.metadata' => 'nullable|array',
            'reservation_id' => 'nullable|exists:reservations,id',
            'notification_key' => 'nullable|string|max:255',
            'outlet' => 'nullable|string|max:255',
            'event_date' => 'nullable|date',
            'event_time' => 'nullable|string|max:50',
            'metadata' => 'nullable|array',
        ]);

        $items = $validated['items'] ?? [$validated];
        $acknowledgments = [];

        foreach ($items as $item) {
            if (empty($item['notification_key']) && empty($item['reservation_id'])) {
                continue;
            }

            if (!empty($item['reservation_id'])) {
                $reservation = Reservation::find($item['reservation_id']);
                if ($reservation && !$this->reservationService->canAccessReservation($admin, $reservation)) {
                    return $this->scopeDeniedResponse();
                }
            }

            $acknowledgment = $this->reservationService->acknowledgeNotification($item, $admin);
            if ($acknowledgment) {
                $acknowledgments[] = $acknowledgment;
            }
        }

        $sharedList = $this->reservationService->notificationAcknowledgments($admin);

        try {
            WebsocketBroadcaster::broadcast('reservations', 'NotificationAcknowledged', [
                'acknowledgments' => $sharedList,
            ]);
        } catch (\Throwable $broadcastError) {
            \Log::warning('Notification acknowledgment broadcast failed: ' . $broadcastError->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Notification acknowledged successfully',
            'data' => $sharedList,
        ]);
    }

    private function currentAdmin(Request $request): ?array
    {
        return $request->attributes->get('admin');
    }

    private function scopeDeniedResponse(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'You are not authorized to access this outlet.',
        ], 403);
    }

    /**
     * Resolves the venue ID dynamically based on room name, slug or metadata,
     * ensuring complete self-healing backward compatibility for legacy frontend clients.
     */
    private function resolveAndMergeVenueId(Request $request): void
    {
        $roomName = $request->input('room');
        $venueId = $request->input('venue_id');

        if (!empty($roomName)) {
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

            if (!$selectedVenue) {
                // Try parent matching using parentVenueNameForRoom
                $parentName = $this->parentVenueNameForRoom($roomName);
                $selectedVenue = Venue::where('is_active', true)
                    ->where('is_archived', false)
                    ->where('name', $parentName)
                    ->first();
            }

            if ($selectedVenue) {
                $targetVenueId = $selectedVenue->parent_id ?: $selectedVenue->id;
                $request->merge(['venue_id' => $targetVenueId]);
                return;
            }
        }

        if (!empty($venueId)) {
            $venue = Venue::find($venueId);
            if (!$venue || !$venue->is_active || $venue->is_archived) {
                // Check metadata canonical ID
                if ($venue && !empty($venue->metadata) && is_array($venue->metadata) && isset($venue->metadata['canonical_venue_id'])) {
                    $canonicalId = $venue->metadata['canonical_venue_id'];
                    $canonicalVenue = Venue::where('is_active', true)->where('is_archived', false)->find($canonicalId);
                    if ($canonicalVenue) {
                        $request->merge(['venue_id' => $canonicalVenue->id]);
                        return;
                    }
                }

                // Match active venue by same name/slug
                if ($venue) {
                    $matchedVenue = Venue::where('is_active', true)
                        ->where('is_archived', false)
                        ->where(function ($query) use ($venue) {
                            $query->where('name', $venue->name)
                                ->orWhere('slug', $venue->slug);
                        })
                        ->first();
                    if ($matchedVenue) {
                        $request->merge(['venue_id' => $matchedVenue->id]);
                        return;
                    }
                }
            }
        }
    }

    private function parentVenueNameForRoom(string $room): string
    {
        $normalized = strtolower(trim($room));

        // 1. Dynamic exact name lookup
        $venue = Venue::where('name', $room)->first();
        if ($venue) {
            if ($venue->parent_id) {
                $parent = Venue::find($venue->parent_id);
                if ($parent) {
                    return $parent->name;
                }
            }
            return $venue->name;
        }

        // 2. Dynamic slug lookup
        $venueBySlug = Venue::where('slug', $room)->first();
        if ($venueBySlug) {
            if ($venueBySlug->parent_id) {
                $parent = Venue::find($venueBySlug->parent_id);
                if ($parent) {
                    return $parent->name;
                }
            }
            return $venueBySlug->name;
        }

        // 3. Dynamic prefix match against non-archived parent venues
        $parentVenue = Venue::whereNull('parent_id')
            ->get()
            ->first(function ($v) use ($normalized) {
                return str_contains($normalized, strtolower($v->name));
            });

        if ($parentVenue) {
            return $parentVenue->name;
        }

        // 4. Legacy hardcoded fallbacks
        if (str_starts_with($normalized, 'laguna ballroom')) {
            return 'Laguna Ballroom';
        }

        if (str_starts_with($normalized, '20/20 function room')) {
            return '20/20 Function Room';
        }

        if (str_starts_with($normalized, 'grand ballroom')) {
            return 'Grand Ballroom';
        }

        if (str_starts_with($normalized, 'tower ')) {
            return 'Tower Ballroom';
        }

        if (str_contains($normalized, 'qsina')) {
            return 'Qsina Restaurant';
        }

        if (str_contains($normalized, 'hanakazu')) {
            return 'Hanakazu Japanese Restaurant';
        }

        if (str_contains($normalized, 'phoenix')) {
            return 'Phoenix Court';
        }

        return $room;
    }
}
