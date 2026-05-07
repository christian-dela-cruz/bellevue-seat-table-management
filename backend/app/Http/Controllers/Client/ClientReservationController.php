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
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Mail;

class ClientReservationController extends Controller
{
    public function index(): JsonResponse
    {
        $reservations = Reservation::with('venue')->orderBy('event_date', 'asc')->get();
        return response()->json($reservations);
    }

    public function store(Request $request): JsonResponse
    {
        \Log::info('Store called, email: ' . $request->email);

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
            'special_requests' => 'nullable|string',
            'type'             => 'required|in:whole,individual,standalone',
            'is_standalone'    => 'nullable|boolean',
            'seat_id'          => 'nullable|string|max:50',
        ]);

        // Fix: Find venue by room name to ensure correct venue_id
        if (!empty($validated['room'])) {
            $venue = Venue::where('name', $validated['room'])->first();
            if ($venue) {
                $validated['venue_id'] = $venue->id;
            }
        } else {
            $validated['room'] = Venue::find($validated['venue_id'])?->name;
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

        // Selected room / sub-room
        if (array_key_exists('room', $validated)) {
            $updateData['room'] = $validated['room'];
        }
        
        // Status
        if (isset($validated['status'])) {
            $updateData['status'] = $validated['status'];
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
}
