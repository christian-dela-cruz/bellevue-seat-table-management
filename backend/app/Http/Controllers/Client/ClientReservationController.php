<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\ReservationTransaction;
use App\Models\Venue;
use App\Services\WebsocketBroadcaster;
use App\Events\ReservationCreated;
use App\Events\SeatReserved;
use App\Events\TableReserved;
use App\Mail\ReservationStatusMail;
use App\Mail\ReferenceCodeRecoveryMail;
use App\Services\ReservationService;
use App\Services\VenueService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class ClientReservationController extends Controller
{
    public function __construct(
        private ReservationService $reservationService,
        private VenueService $venueService,
    )
    {
    }

    /**
     * SQLite databases created before standalone support still enforce
     * a two-value CHECK constraint on reservations.type. Keep the explicit
     * standalone markers, but store a SQLite-safe fallback type until the
     * corrective migration is applied.
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
        $reservations = Reservation::with('venue')
            ->when($request->filled('venue_id'), function ($query) use ($request) {
                $query->where('venue_id', $request->query('venue_id'));
            })
            ->when($request->filled('room'), function ($query) use ($request) {
                $room = $request->query('room');
                $query->where(function ($roomQuery) use ($room) {
                    $roomQuery->where('room', $room)
                        ->orWhereHas('venue', fn ($venueQuery) => $venueQuery->where('name', $room));
                });
            })
            ->when($request->filled('wing'), function ($query) use ($request) {
                $query->whereHas('venue', fn ($venueQuery) => $venueQuery->where('wing', $request->query('wing')));
            })
            ->when($request->filled('event_date'), function ($query) use ($request) {
                $query->whereDate('event_date', $request->query('event_date'));
            })
            ->when($request->filled('event_time'), function ($query) use ($request) {
                $time = substr((string) $request->query('event_time'), 0, 5);
                $query->where(function ($timeQuery) use ($time) {
                    $timeQuery->where('event_time', $time)
                        ->orWhere('event_time', $time . ':00');
                });
            })
            ->orderBy('event_date', 'asc')
            ->get();

        return response()->json($reservations);
    }

    public function store(Request $request): JsonResponse
    {
        \Log::info('Store called, email: ' . $request->email);

        $this->resolveAndMergeVenueId($request);

        $validated = $request->validate([
            'name'             => 'required|string|max:255',
            'email'            => 'required|email|max:255',
            'phone'            => 'required|string|max:20',
            'venue_id'         => 'required|exists:venues,id',
            'room'             => 'nullable|string|max:255',
            'table_number'     => 'nullable|string|max:50',
            'seat_number'      => 'nullable|string|max:50',
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
            'seat_id'          => 'nullable|string|max:50',
        ]);

        // Keep sub-room reservations tied to their parent venue for booking scope,
        // while still letting VenueService enforce the selected child room's state.
        if (!empty($validated['room'])) {
            $selectedVenue = $this->venueService->findVenueForAvailability(['room' => $validated['room']]);
            if ($selectedVenue) {
                $validated['venue_id'] = $selectedVenue->parent_id ?: $selectedVenue->id;
            } else {
                $venue = Venue::where('name', $this->parentVenueNameForRoom($validated['room']))->first();
                if ($venue) {
                    $validated['venue_id'] = $venue->id;
                }
            }
        } else {
            $validated['room'] = Venue::find($validated['venue_id'])?->name;
        }

        $requestedVenue = Venue::find($validated['venue_id']);
        if ($requestedVenue) {
            if ($requestedVenue->parent_id !== null && !$requestedVenue->child_selectable) {
                return response()->json([
                    'success' => false,
                    'message' => 'Manual selection of this subroom is not allowed.',
                ], 422);
            }

            // Tie to parent venue
            $parentVenue = $requestedVenue->parent_id ? Venue::find($requestedVenue->parent_id) : $requestedVenue;
            $validated['venue_id'] = $parentVenue->id;
            $validated['room'] = $parentVenue->name;
            $validated['public_room_name'] = $parentVenue->name;

            // If it's a parent room (i.e. has children)
            $children = $parentVenue->children()
                ->where('is_active', true)
                ->where('is_archived', false)
                ->where('reservations_enabled', true)
                ->get();

            if ($children->isNotEmpty()) {
                $allocationMode = $parentVenue->metadata['allocation_mode'] ?? 'admin_assign';
                
                // Perform dynamic availability check for parent venue
                $slots = $this->venueService->getReservationTimeSlots(
                    $parentVenue,
                    $validated['event_date'],
                    (int) ($validated['guests_count'] ?? 1),
                    $parentVenue->name
                );
                
                $slotTime = substr((string) $validated['event_time'], 0, 5);
                $isAvailable = false;
                foreach ($slots['slots'] as $slot) {
                    if (substr($slot['time'], 0, 5) === $slotTime) {
                        $isAvailable = (bool) $slot['available'];
                        break;
                    }
                }
                
                if (!$isAvailable) {
                    return response()->json([
                        'success' => false,
                        'message' => "{$parentVenue->display_name} is fully booked for the selected schedule. Please choose another date or time.",
                    ], 422);
                }

                // If available, perform allocation
                if ($allocationMode === 'auto_assign' && $validated['type'] !== 'whole') {
                    $availableSubrooms = $this->venueService->getAvailableSubrooms(
                        $parentVenue,
                        $validated['event_date'],
                        $validated['event_time'],
                        (int) ($validated['guests_count'] ?? 1)
                    );
                    
                    if (!empty($availableSubrooms)) {
                        $assigned = $availableSubrooms[0];
                        $validated['assigned_room_id'] = $assigned['id'] ?? $assigned->id;
                        $validated['internal_room_name'] = $assigned['name'] ?? $assigned->name;
                        $validated['assignment_status'] = 'auto_assigned';
                    } else {
                        $validated['assigned_room_id'] = null;
                        $validated['internal_room_name'] = null;
                        $validated['assignment_status'] = 'pending_assignment';
                    }
                } elseif ($allocationMode === 'whole_booking') {
                    $validated['assigned_room_id'] = null;
                    $validated['internal_room_name'] = 'Whole Venue';
                    $validated['assignment_status'] = 'auto_assigned';
                } else {
                    $validated['assigned_room_id'] = null;
                    $validated['internal_room_name'] = null;
                    $validated['assignment_status'] = 'pending_assignment';
                }
            }
        }

        $validated = $this->normalizeStandaloneReservation($validated);

        if (!$this->venueService->isTimeSlotAvailable($validated)) {
            return response()->json([
                'success' => false,
                'message' => 'The selected reservation time is no longer available for this venue.',
            ], 422);
        }

        if ($this->reservationService->hasScheduleConflict($validated)) {
            return response()->json([
                'success' => false,
                'message' => 'The selected seat or table is already held or reserved for that date and time.',
            ], 422);
        }

        $validated['reference_code'] = date('Y') . '-' . str_pad(mt_rand(1, 9999), 4, '0', STR_PAD_LEFT);
        $validated['status']         = 'pending';
        $validated['submitted_at']   = now();

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

        if ($reservation->type === 'individual' && $reservation->seat_number) {
            broadcast(new SeatReserved($reservation->seat_number, $reservation->table_number))->toOthers();
            WebsocketBroadcaster::broadcast('reservations', 'SeatReserved', [
                'seatNumber'  => $reservation->seat_number,
                'tableNumber' => $reservation->table_number
            ]);
        } elseif ($reservation->type === 'whole' && $reservation->table_number) {
            broadcast(new TableReserved($reservation->table_number, $reservation->guests_count))->toOthers();
            WebsocketBroadcaster::broadcast('reservations', 'TableReserved', [
                'tableNumber' => $reservation->table_number,
                'guests'      => $reservation->guests_count
            ]);
        }

        return response()->json($reservation, 201);
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

    public function show(Reservation $reservation): JsonResponse
    {
        $reservation->load(['venue']);
        return response()->json($reservation);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $reservation = Reservation::findOrFail($id);
        
        $validated = $request->validate([
            'name'             => 'sometimes|required|string|max:255',
            'email'            => 'sometimes|required|email|max:255',
            'phone'            => 'sometimes|required|string|max:20',
            'contact_number'    => 'sometimes|required|string|max:20',
            'mobile'           => 'sometimes|required|string|max:20',
            'room'             => 'sometimes|nullable|string|max:255',
            'guests_count'     => 'sometimes|required|integer|min:1',
            'guests'           => 'sometimes|required|integer|min:1',
            'number_of_guests' => 'sometimes|required|integer|min:1',
            'event_date'       => 'sometimes|required|date',
            'eventDate'        => 'sometimes|required|date',
            'date'             => 'sometimes|required|date',
            'event_time'       => 'sometimes|required|string|max:50',
            'eventTime'        => 'sometimes|required|string|max:50',
            'time'             => 'sometimes|required|string|max:50',
            'event_area'       => 'sometimes|nullable|string|max:255',
            'setup_tables'     => 'sometimes|nullable|integer|min:0|max:999',
            'setup_chairs'     => 'sometimes|nullable|integer|min:0|max:9999',
            'setup_requirements' => 'sometimes|nullable|string|max:5000',
            'special_requests' => 'sometimes|nullable|string',
            'status'           => 'sometimes|required|in:pending,approved,rejected,reserved,cancelled',
        ]);

        $updateData = [];

        if (isset($validated['name'])) {
            $updateData['name'] = $validated['name'];
        }
        if (isset($validated['email'])) {
            $updateData['email'] = $validated['email'];
        }
        
        // Phone numbers - use first available
        if (isset($validated['phone'])) {
            $updateData['phone'] = $validated['phone'];
        } elseif (isset($validated['contact_number'])) {
            $updateData['phone'] = $validated['contact_number'];
        } elseif (isset($validated['mobile'])) {
            $updateData['phone'] = $validated['mobile'];
        }
        
        // Guest count - use first available
        if (isset($validated['guests_count'])) {
            $updateData['guests_count'] = $validated['guests_count'];
        } elseif (isset($validated['guests'])) {
            $updateData['guests_count'] = $validated['guests'];
        } elseif (isset($validated['number_of_guests'])) {
            $updateData['guests_count'] = $validated['number_of_guests'];
        }
        
        // Event date - use first available
        if (isset($validated['event_date'])) {
            $updateData['event_date'] = $validated['event_date'];
        } elseif (isset($validated['eventDate'])) {
            $updateData['event_date'] = $validated['eventDate'];
        } elseif (isset($validated['date'])) {
            $updateData['event_date'] = $validated['date'];
        }
        
        // Event time - use first available
        if (isset($validated['event_time'])) {
            $updateData['event_time'] = $validated['event_time'];
        } elseif (isset($validated['eventTime'])) {
            $updateData['event_time'] = $validated['eventTime'];
        } elseif (isset($validated['time'])) {
            $updateData['event_time'] = $validated['time'];
        }
        
        // Special requests
        if (isset($validated['special_requests'])) {
            $updateData['special_requests'] = $validated['special_requests'];
        }

        foreach (['event_area', 'setup_tables', 'setup_chairs', 'setup_requirements'] as $setupField) {
            if (array_key_exists($setupField, $validated)) {
                $updateData[$setupField] = $validated[$setupField];
            }
        }

        // Selected room / sub-room
        if (array_key_exists('room', $validated)) {
            $updateData['room'] = $validated['room'];
            $selectedVenue = $this->venueService->findVenueForAvailability(['room' => $validated['room']]);
            if ($selectedVenue) {
                $updateData['venue_id'] = $selectedVenue->parent_id ?: $selectedVenue->id;
            }
        }
        
        // Status
        if (isset($validated['status'])) {
            $updateData['status'] = $validated['status'];
        }

        $candidate = array_merge($reservation->only([
            'venue_id',
            'room',
            'guests_count',
            'event_date',
            'event_time',
        ]), $updateData);
        $candidate['event_date'] = $candidate['event_date'] instanceof \DateTimeInterface
            ? $candidate['event_date']->format('Y-m-d')
            : $candidate['event_date'];

        if (
            (array_key_exists('room', $updateData)
                || array_key_exists('guests_count', $updateData)
                || array_key_exists('event_date', $updateData)
                || array_key_exists('event_time', $updateData))
            && !$this->venueService->isTimeSlotAvailable($candidate, $reservation->id)
        ) {
            return response()->json([
                'success' => false,
                'message' => 'The selected reservation time is no longer available for this venue.',
            ], 422);
        }

        $reservation->update($updateData);
        
        // Load relationships and return with all aliases for frontend compatibility
        $reservation->load(['venue']);
        
        // Build response with all field aliases so frontend can pick them up
        $response = [
            'data' => [
                'id' => $reservation->reference_code ?? $reservation->id,
                'db_id' => $reservation->id,
                'reference_code' => $reservation->reference_code,
                'name' => $reservation->name,
                'email' => $reservation->email,
                'phone' => $reservation->phone,
                'contact_number' => $reservation->phone, // Alias
                'mobile' => $reservation->phone, // Alias
                'event_date' => $reservation->event_date,
                'eventDate' => $reservation->event_date, // Alias
                'date' => $reservation->event_date, // Alias
                'event_time' => $reservation->event_time,
                'eventTime' => $reservation->event_time, // Alias
                'time' => $reservation->event_time, // Alias
                'guests_count' => $reservation->guests_count,
                'guests' => $reservation->guests_count, // Alias
                'number_of_guests' => $reservation->guests_count, // Alias
                'special_requests' => $reservation->special_requests,
                'event_area' => $reservation->event_area,
                'setup_tables' => $reservation->setup_tables,
                'setup_chairs' => $reservation->setup_chairs,
                'setup_requirements' => $reservation->setup_requirements,
                'status' => $reservation->status,
                'venue' => $reservation->venue,
                'room' => $reservation->room ?? $reservation->venue?->name,
                'table_number' => $reservation->table_number,
                'seat_number' => $reservation->seat_number,
                'type' => $reservation->type,
                'created_at' => $reservation->created_at,
                'updated_at' => $reservation->updated_at,
            ]
        ];
        
        return response()->json($response);
    }

    public function destroy(Reservation $reservation): JsonResponse
    {
        $reservation->delete();
        return response()->json(null, 204);
    }

    public function getVenueReservations(Venue $venue): JsonResponse
    {
        $reservations = $venue->reservations()
            ->orderBy('event_date', 'asc')
            ->get();
        return response()->json($reservations);
    }

    public function approve(Reservation $reservation): JsonResponse
    {
        $reservation->update(['status' => 'approved']);
        return response()->json($reservation);
    }

    public function reject(Request $request, $id): JsonResponse
    {
        try {
            $validated = $request->validate([
                'reason' => 'sometimes|nullable|string|max:1000',
            ]);

            $reservation = Reservation::findOrFail($id);
            if (!in_array($reservation->status, ['pending', 'approved', 'reserved'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Only pending or approved reservations can be cancelled.',
                ], 422);
            }

            $cancelReason = trim((string)($validated['reason'] ?? ''));
            $cancelReason = $cancelReason !== '' ? $cancelReason : null;
            $fromStatus = $reservation->status;

            $reservation->update([
                'status' => 'rejected',
                'rejection_reason' => null,
                'cancellation_reason' => $cancelReason,
                'cancelled_at' => now(),
            ]);

            ReservationTransaction::create([
                'reservation_id' => $reservation->id,
                'action' => 'status_changed',
                'from_status' => $fromStatus,
                'to_status' => $reservation->status,
                'notes' => 'Reservation cancelled by guest.',
                'metadata' => $cancelReason ? ['reason' => $cancelReason] : null,
            ]);

            // Send cancellation email to client
            try {
                Mail::to($reservation->email)
                    ->send(new ReservationStatusMail($reservation, 'cancelled', $cancelReason ?: 'Cancelled by guest'));
                ReservationTransaction::create([
                    'reservation_id' => $reservation->id,
                    'action' => 'notification_sent',
                    'from_status' => $reservation->status,
                    'to_status' => $reservation->status,
                    'notes' => 'Cancellation email sent to guest.',
                    'metadata' => ['channel' => 'email', 'type' => 'reservation_cancelled'],
                ]);
            } catch (\Exception $e) {
                \Log::error('Failed to send cancellation email: ' . $e->getMessage());
                ReservationTransaction::create([
                    'reservation_id' => $reservation->id,
                    'action' => 'notification_failed',
                    'from_status' => $reservation->status,
                    'to_status' => $reservation->status,
                    'notes' => 'Cancellation email failed to send.',
                    'metadata' => ['channel' => 'email', 'type' => 'reservation_cancelled', 'error' => $e->getMessage()],
                ]);
            }

            // Broadcast update
            try {
                broadcast(new \App\Events\ReservationUpdated($reservation))->toOthers();
                WebsocketBroadcaster::broadcast('reservations', 'ReservationUpdated', [
                    'reservation' => $reservation
                ]);
            } catch (\Throwable $broadcastError) {
                \Log::warning('Reservation cancel broadcast failed: ' . $broadcastError->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Booking cancelled successfully',
                'reservation_id' => $reservation->reference_code,
                'data' => [
                    'id' => $reservation->reference_code,
                    'db_id' => $reservation->id,
                    'reference_code' => $reservation->reference_code,
                    'status' => $reservation->status,
                    'name' => $reservation->name,
                    'email' => $reservation->email,
                    'phone' => $reservation->phone,
                    'event_date' => $reservation->event_date,
                    'event_time' => $reservation->event_time,
                    'guests_count' => $reservation->guests_count,
                    'special_requests' => $reservation->special_requests,
                    'event_area' => $reservation->event_area,
                    'setup_tables' => $reservation->setup_tables,
                    'setup_chairs' => $reservation->setup_chairs,
                    'setup_requirements' => $reservation->setup_requirements,
                    'cancellation_reason' => $reservation->cancellation_reason,
                    'cancelled_at' => $reservation->cancelled_at,
                    'venue' => $reservation->venue,
                    'room' => $reservation->room ?? $reservation->venue?->name,
                    'table_number' => $reservation->table_number,
                    'seat_number' => $reservation->seat_number,
                    'type' => $reservation->type,
                    'updated_at' => $reservation->updated_at,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Send a status notification email for a reservation.
     * Called after approve or reject from the admin dashboard.
     *
     * POST /api/reservations/{reservation}/notify
        * Body: { status: "approved"|"rejected"|"cancelled", rejection_reason?: string }
     */
    public function notify(Request $request, Reservation $reservation)
    {
        $status          = $request->input('status');
        $rejectionReason = $request->input('rejection_reason', '');

        if (!in_array($status, ['approved', 'rejected', 'pending', 'cancelled'])) {
            return response()->json(['message' => 'Invalid status'], 422);
        }

        try {
            \Mail::to($reservation->email)->send(
                new \App\Mail\ReservationStatusMail($reservation, $status, $rejectionReason)
            );
            return response()->json(['success' => true, 'message' => 'Email sent.']);
        } catch (\Exception $e) {
            \Log::error('[ClientReservationController::notify] Mail failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Mail failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Recover reference codes via email.
     * Looks up all active reservations for the given email address and sends
     * them in a branded recovery email. Always returns a generic success
     * message to prevent email enumeration.
     *
     * POST /api/reservations/recover-code
     * Body: { email: "guest@example.com" }
     */
    public function recoverReferenceCode(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email|max:255',
        ]);

        $email = strtolower(trim($validated['email']));

        // Find all active (non-cancelled, non-rejected) reservations for this email
        $reservations = Reservation::with('venue')
            ->whereRaw('lower(email) = ?', [$email])
            ->whereNotIn('status', ['cancelled'])
            ->orderBy('event_date', 'desc')
            ->get();

        if ($reservations->isNotEmpty()) {
            try {
                Mail::to($email)
                    ->send(new ReferenceCodeRecoveryMail($reservations));
                \Log::info("Reference code recovery email sent to: {$email} ({$reservations->count()} reservations)");
            } catch (\Exception $e) {
                \Log::error('Failed to send reference code recovery email: ' . $e->getMessage());
            }
        }

        // Always return success to prevent email enumeration
        return response()->json([
            'success' => true,
            'message' => 'If a reservation exists with this email address, we have sent your reference code(s) to your inbox.',
        ]);
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
}
