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
            $wing = urldecode($wing);
            $room = urldecode($room);
            
            // Search by name only since frontend wing structure might not match DB perfectly
            $venue = Venue::where('name', $room)->first();
            if (!$venue) {
                return response()->json(['success' => false, 'message' => 'Venue not found'], 404);
            }

            return $this->getSeatmapById($request, $venue->id);
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
            $venue = Venue::find($venueId);
            if (!$venue) {
                return response()->json(['success' => false, 'message' => 'Venue not found'], 404);
            }

            // Fallback inheritance logic: if parent venue has no layout, try to find a child that has one
            $payload = $venue->seatmap_payload;
            
            if (empty($payload)) {
                $childWithLayout = Venue::where('parent_id', $venue->id)
                    ->whereNotNull('seatmap_payload')
                    ->first();
                if ($childWithLayout) {
                    $payload = $childWithLayout->seatmap_payload;
                }
            }

            if (empty($payload)) {
                // If strictly no layout exists, check if legacy Seats exist as a fallback
                $seats = Seat::where('venue_id', $venue->id)->get();
                if ($seats->isEmpty()) {
                    return response()->json([
                        'success' => true,
                        'data' => null,
                        'venue' => [
                            'id' => $venue->id,
                            'name' => $venue->name,
                            'wing' => $venue->wing,
                        ]
                    ]);
                }
                
                // Legacy dynamic build
                $tables = [];
                foreach ($seats as $seat) {
                    $tableNumber = $seat->table_number;
                    if (!isset($tables[$tableNumber])) {
                        $tables[$tableNumber] = ['id' => $tableNumber, 'seats' => []];
                    }
                    $tables[$tableNumber]['seats'][] = [
                        'id' => $seat->seat_number,
                        'num' => $seat->seat_number,
                        'status' => 'available',
                        'x' => $seat->x_position,
                        'y' => $seat->y_position,
                    ];
                }
                $payload = json_encode([
                    'v' => 2,
                    'tables' => array_values($tables),
                    'labels' => null,
                    'standaloneSeats' => []
                ]);
            }

            $data = is_string($payload) ? json_decode($payload, true) : $payload;

            // Merge dynamic reservations if event_date is requested
            if ($request->filled('event_date') && isset($data['tables'])) {
                $reservations = $this->scheduledReservations($request, $venue->id);
                
                foreach ($data['tables'] as &$table) {
                    if (isset($table['seats'])) {
                        foreach ($table['seats'] as &$seat) {
                            $reservation = $this->reservationForSeat($reservations, $table['id'], $seat['id']);
                            if ($reservation) {
                                $seat['status'] = $this->publicSeatStatus($reservation->status);
                            }
                        }
                    }
                }
                
                if (isset($data['standaloneSeats'])) {
                    foreach ($data['standaloneSeats'] as &$seat) {
                        $reservation = $this->reservationForSeat($reservations, 'STANDALONE', $seat['id']);
                        if ($reservation) {
                            $seat['status'] = $this->publicSeatStatus($reservation->status);
                        }
                    }
                }
            }

            return response()->json([
                'success' => true,
                'data' => $data,
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
     * Save seatmap data for a venue by wing and room
     */
    public function saveSeatmap(Request $request, string $wing, string $room): JsonResponse
    {
        try {
            $wing = urldecode($wing);
            $room = urldecode($room);
            
            // Search by name only since frontend wing structure might not match DB perfectly
            $venue = Venue::where('name', $room)->first();
            if (!$venue) {
                return response()->json(['success' => false, 'message' => 'Venue not found'], 404);
            }

            $venue->seatmap_payload = json_encode($request->all());
            $venue->save();

            return response()->json([
                'success' => true,
                'message' => 'Seatmap saved successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Save seatmap data for a venue by ID
     */
    public function saveSeatmapById(Request $request, int $venueId): JsonResponse
    {
        try {
            $venue = Venue::find($venueId);
            if (!$venue) {
                return response()->json(['success' => false, 'message' => 'Venue not found'], 404);
            }

            $venue->seatmap_payload = json_encode($request->all());
            $venue->save();

            return response()->json([
                'success' => true,
                'message' => 'Seatmap saved successfully'
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
            ->whereIn('status', ['pending', 'approved', 'reserved'])
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

    private function publicSeatStatus(?string $status): string
    {
        return match ($status) {
            'pending' => 'pending',
            'approved', 'reserved' => 'reserved',
            default => $status ?: 'available',
        };
    }
}
