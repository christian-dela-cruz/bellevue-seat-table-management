<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Seat;
use App\Models\Reservation;
use App\Models\Venue;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class SeatMapController extends Controller
{
    /**
     * Get seatmap data for a specific venue/room
     */
    public function getSeatmap(Request $request, string $wing, string $room): JsonResponse
    {
        try {
            // URL decode parameters
            $wing = urldecode($wing);
            $room = urldecode($room);
            
            // Debug logging
            \Log::info("SeatMap request - Wing: '$wing', Room: '$room'");
            
            // Find the venue by name and wing
            $venue = Venue::where('name', $room)
                ->where('wing', $wing)
                ->first();

            if (!$venue) {
                \Log::warning("Venue not found - Wing: '$wing', Room: '$room'");
                return response()->json(['success' => false, 'message' => 'Venue not found', 'debug' => ['wing' => $wing, 'room' => $room]], 404);
            }

            // Get all seats for this venue
            $seats = Seat::where('venue_id', $venue->id)->get();

            $reservations = $this->scheduledReservations($request, $venue->id);

            // Group seats by table to match frontend structure
            $tables = [];
            foreach ($seats as $seat) {
                $tableNumber = $seat->table_number;
                
                // Initialize table if not exists
                if (!isset($tables[$tableNumber])) {
                    $tables[$tableNumber] = [
                        'id' => $tableNumber,
                        'seats' => []
                    ];
                }
                
                // Check if seat is reserved
                $reservation = $this->reservationForSeat($reservations, $seat->table_number, $seat->seat_number);
                $status = $reservation
                    ? ($reservation->status === 'approved' ? 'reserved' : $reservation->status)
                    : ($request->filled('event_date') ? ($seat->status === 'maintenance' ? 'maintenance' : 'available') : ($seat->status ?? 'available'));
                
                // Add seat to table
                $tables[$tableNumber]['seats'][] = [
                    'id' => $seat->seat_number,
                    'num' => $seat->seat_number,
                    'status' => $status,
                    'x' => $seat->x_position,
                    'y' => $seat->y_position,
                ];
            }

            // Process standalone seats
            $standaloneSeats = [];
            $standaloneReservations = $reservations->filter(function($reservation) {
                return $reservation->table_number === 'STANDALONE' || 
                       $reservation->type === 'standalone' || 
                       $reservation->is_standalone == 1;
            });

            // Create standalone seat entries for reservations
            foreach ($standaloneReservations as $reservation) {
                $standaloneSeats[] = [
                    'id' => $reservation->seat_id ?? 'STANDALONE-' . $reservation->seat_number,
                    'num' => $reservation->seat_number,
                    'label' => $reservation->seat_number,
                    'status' => $reservation->status === 'approved' ? 'reserved' : $reservation->status,
                    'x' => 50 + (count($standaloneSeats) * 100), // Position dynamically
                    'y' => 300,
                ];
            }

            // Convert to array and sort by table ID
            $tableArray = array_values($tables);
            usort($tableArray, function($a, $b) {
                return strcasecmp($a['id'], $b['id']);
            });

            return response()->json([
                'success' => true,
                'data' => [
                    'v' => 2,
                    'tables' => $tableArray,
                    'labels' => null,
                    'standaloneSeats' => $standaloneSeats
                ],
                'venue' => [
                    'id' => $venue->id,
                    'name' => $venue->name,
                    'wing' => $venue->wing,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get seatmap data by venue ID
     */
    public function getSeatmapById(Request $request, int $venueId): JsonResponse
    {
        try {
            // Find venue by ID
            $venue = Venue::find($venueId);

            if (!$venue) {
                return response()->json(['success' => false, 'message' => 'Venue not found'], 404);
            }

            // Get all seats for this venue
            $seats = Seat::where('venue_id', $venue->id)->get();

            $reservations = $this->scheduledReservations($request, $venue->id);

            // Group seats by table to match frontend structure
            $tables = [];
            foreach ($seats as $seat) {
                $tableNumber = $seat->table_number;
                
                // Initialize table if not exists
                if (!isset($tables[$tableNumber])) {
                    $tables[$tableNumber] = [
                        'id' => $tableNumber,
                        'seats' => []
                    ];
                }
                
                // Check if seat is reserved
                $reservation = $this->reservationForSeat($reservations, $seat->table_number, $seat->seat_number);
                $status = $reservation
                    ? ($reservation->status === 'approved' ? 'reserved' : $reservation->status)
                    : ($request->filled('event_date') ? ($seat->status === 'maintenance' ? 'maintenance' : 'available') : ($seat->status ?? 'available'));
                
                // Add seat to table
                $tables[$tableNumber]['seats'][] = [
                    'id' => $seat->seat_number,
                    'num' => $seat->seat_number,
                    'status' => $status,
                    'x' => $seat->x_position,
                    'y' => $seat->y_position,
                ];
            }

            // Process standalone seats
            $standaloneSeats = [];
            $standaloneReservations = $reservations->filter(function($reservation) {
                return $reservation->table_number === 'STANDALONE' || 
                       $reservation->type === 'standalone' || 
                       $reservation->is_standalone == 1;
            });

            // Create standalone seat entries for reservations
            foreach ($standaloneReservations as $reservation) {
                $standaloneSeats[] = [
                    'id' => $reservation->seat_id ?? 'STANDALONE-' . $reservation->seat_number,
                    'num' => $reservation->seat_number,
                    'label' => $reservation->seat_number,
                    'status' => $reservation->status === 'approved' ? 'reserved' : $reservation->status,
                    'x' => 50 + (count($standaloneSeats) * 100), // Position dynamically
                    'y' => 300,
                ];
            }

            // Convert to array and sort by table ID
            $tableArray = array_values($tables);
            usort($tableArray, function($a, $b) {
                return strcasecmp($a['id'], $b['id']);
            });

            return response()->json([
                'success' => true,
                'data' => [
                    'v' => 2,
                    'tables' => $tableArray,
                    'labels' => null,
                    'standaloneSeats' => $standaloneSeats
                ],
                'venue' => [
                    'id' => $venue->id,
                    'name' => $venue->name,
                    'wing' => $venue->wing,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    private function scheduledReservations(Request $request, int $venueId)
    {
        return Reservation::where('venue_id', $venueId)
            ->when($request->filled('room'), function ($query) use ($request) {
                $query->where('room', $request->query('room'));
            })
            ->whereIn('status', ['approved', 'reserved'])
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
            ->get();
    }

    private function reservationForSeat($reservations, ?string $tableNumber, ?string $seatNumber): ?Reservation
    {
        $table = trim((string) $tableNumber);
        $seat = trim((string) $seatNumber);

        return $reservations->first(function (Reservation $reservation) use ($table, $seat) {
            if (strtoupper((string) $reservation->table_number) === 'STANDALONE') {
                return false;
            }

            if (trim((string) $reservation->table_number) !== $table) {
                return false;
            }

            if ($reservation->type === 'whole' || blank($reservation->seat_number)) {
                return true;
            }

            $reservedSeats = array_map('trim', explode(',', (string) $reservation->seat_number));

            return in_array($seat, $reservedSeats, true);
        });
    }
}
