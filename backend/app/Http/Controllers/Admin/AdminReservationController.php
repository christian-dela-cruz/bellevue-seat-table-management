<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\Venue;
use App\Services\ReservationService;
use App\Services\WebsocketBroadcaster;
use App\Events\ReservationCreated;
use App\Events\ReservationUpdated;
use App\Events\ReservationDeleted;
use App\Mail\ReservationStatusMail;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class AdminReservationController extends Controller
{
    protected $reservationService;

    public function __construct(ReservationService $reservationService)
    {
        $this->reservationService = $reservationService;
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
                                 ->getAllReservationsPaginated($page, $perPage, $sort, $direction);

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

    public function getStats(): JsonResponse
    {
        try {
            $stats = $this->reservationService->getReservationStats();
            return response()->json($stats);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'             => 'required|string|max:255',
            'email'            => 'required|email|max:255',
            'phone'            => 'required|string|max:20',
            'venue_id'         => 'required|exists:venues,id',
            'table_number'     => 'nullable|string|max:50',
            'seat_number'      => 'nullable|string|max:50',
            'guests_count'     => 'required|integer|min:1',
            'event_date'       => 'required|date',
            'event_time'       => 'required|string|max:50',
            'special_requests' => 'nullable|string',
            'type'             => 'required|in:whole,individual',
        ]);

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

        return response()->json($reservation, 201);
    }

    public function show(Reservation $reservation): JsonResponse
    {
        $reservation->load(['venue', 'seats']);
        return response()->json($reservation);
    }

    public function update(Request $request, Reservation $reservation): JsonResponse
    {
        $validated = $request->validate([
            'name'             => 'sometimes|required|string|max:255',
            'email'            => 'sometimes|required|email|max:255',
            'phone'            => 'sometimes|required|string|max:20',
            'guests_count'     => 'sometimes|required|integer|min:1',
            'event_date'       => 'sometimes|required|date',
            'event_time'       => 'sometimes|required|string|max:50',
            'special_requests' => 'sometimes|nullable|string',
            'status'           => 'sometimes|required|in:pending,approved,rejected,reserved,cancelled',
        ]);

        $reservation->update($validated);

        broadcast(new ReservationUpdated($reservation))->toOthers();
        WebsocketBroadcaster::broadcast('reservations', 'ReservationUpdated', [
            'reservation' => $reservation
        ]);

        return response()->json($reservation);
    }

    public function destroy(string $id): JsonResponse
    {
        try {
            $reservation = Reservation::where('id', $id)->first();
            if (!$reservation) {
                $reservation = Reservation::where('reference_code', $id)->firstOrFail();
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

    public function approve(int $id): JsonResponse
    {
        \Log::info('AdminReservationController::approve called for reservation ID: ' . $id);
        
        try {
            $reservation = Reservation::findOrFail($id);
            \Log::info('Reservation found: ' . $reservation->email . ', status: ' . $reservation->status);
            
            $reservation = $this->reservationService->approveReservation($reservation);
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
                    ['channel' => 'email', 'type' => 'reservation_confirmed']
                );
            } catch (\Exception $e) {
                \Log::error('Failed to send approval email: ' . $e->getMessage());
                $this->reservationService->recordTransaction(
                    $reservation,
                    'notification_failed',
                    $reservation->status,
                    $reservation->status,
                    'Confirmation email failed to send.',
                    ['channel' => 'email', 'type' => 'reservation_confirmed', 'error' => $e->getMessage()]
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

            if ($reservation->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only pending reservations can be rejected.',
                ], 422);
            }
            
            $reservation = $this->reservationService->rejectReservation($reservation, $validated['reason']);
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
                    ['channel' => 'email', 'type' => 'reservation_rejected']
                );
            } catch (\Exception $e) {
                \Log::error('Failed to send rejection email: ' . $e->getMessage());
                $this->reservationService->recordTransaction(
                    $reservation,
                    'notification_failed',
                    $reservation->status,
                    $reservation->status,
                    'Rejection email failed to send.',
                    ['channel' => 'email', 'type' => 'reservation_rejected', 'error' => $e->getMessage()]
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

            if ($reservation->status !== 'rejected') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only rejected reservations can be reverted.',
                ], 422);
            }

            $reservation = $this->reservationService->revertRejectedReservation($reservation);

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
}
