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
            $isEmptyPayload = empty($payload) || $payload === '{}' || $payload === '[]' || strlen(trim($payload)) < 5;
            
            if ($isEmptyPayload) {
                $childWithLayout = Venue::where('parent_id', $venue->id)
                    ->whereNotNull('seatmap_payload')
                    ->where('seatmap_payload', '!=', '{}')
                    ->where('seatmap_payload', '!=', '[]')
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
            $data = is_array($data) ? $this->layoutWithAvailabilityDefaults($data) : $data;

            // Merge dynamic reservations only for the exact selected schedule.
            if ($request->filled('event_date') && $request->filled('event_time') && isset($data['tables'])) {
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
            ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
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

            $venue->seatmap_payload = json_encode($this->layoutWithAvailabilityDefaults($request->all()));
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

            $venue->seatmap_payload = json_encode($this->layoutWithAvailabilityDefaults($request->all()));
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
        $venue = Venue::find($venueId);
        $parentId = $venue ? $venue->parent_id : null;
        $requestedTime = $this->normalizeTimeValue($request->query('event_time'));

        $reservations = Reservation::query()
            ->where(function ($query) use ($venueId, $parentId, $venue) {
                if ($parentId) {
                    $query->where('venue_id', $parentId)
                          ->where(function ($sub) use ($venueId, $venue) {
                              $sub->where('assigned_room_id', $venueId);
                              if ($venue) {
                                  $sub->orWhere('room', $venue->name);
                              }
                          });
                } else {
                    $query->where('venue_id', $venueId)
                          ->orWhere('assigned_room_id', $venueId);
                }
            })
            ->whereIn('status', ['pending', 'approved', 'reserved'])
            ->when($request->filled('event_date'), function ($query) use ($request) {
                $query->whereDate('event_date', $request->query('event_date'));
            })
            ->get();

        if (!$requestedTime) {
            return $reservations;
        }

        return $reservations
            ->filter(fn (Reservation $reservation) => $this->normalizeTimeValue($reservation->event_time) === $requestedTime)
            ->values();
    }

    private function layoutWithAvailabilityDefaults(array $data): array
    {
        if (isset($data['tables']) && is_array($data['tables'])) {
            foreach ($data['tables'] as &$table) {
                if (!isset($table['seats']) || !is_array($table['seats'])) {
                    continue;
                }

                foreach ($table['seats'] as &$seat) {
                    $seat = $this->seatWithDefaultAvailability($seat);
                }
                unset($seat);
            }
            unset($table);
        }

        if (isset($data['standaloneSeats']) && is_array($data['standaloneSeats'])) {
            foreach ($data['standaloneSeats'] as &$seat) {
                $seat = $this->seatWithDefaultAvailability($seat);
            }
            unset($seat);
        }

        return $data;
    }

    private function seatWithDefaultAvailability(array $seat): array
    {
        $status = strtolower((string) ($seat['status'] ?? 'available'));
        $seat['status'] = $status === 'maintenance' ? 'maintenance' : 'available';

        return $seat;
    }

    private function normalizeTimeValue($value): ?string
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            return null;
        }

        if (preg_match('/(\d{1,2}):(\d{2})\s*(AM|PM)?/i', $raw, $matches)) {
            $hour = (int) $matches[1];
            $minute = (int) $matches[2];
            $period = strtoupper($matches[3] ?? '');

            if ($period === 'PM' && $hour < 12) {
                $hour += 12;
            } elseif ($period === 'AM' && $hour === 12) {
                $hour = 0;
            }

            return sprintf('%02d:%02d', $hour, $minute);
        }

        return substr($raw, 0, 5);
    }

    private function reservationForSeat($reservations, ?string $tableNumber, ?string $seatNumber): ?Reservation
    {
        $table = trim((string) $tableNumber);
        $seat = trim((string) $seatNumber);

        return $reservations->first(function (Reservation $reservation) use ($table, $seat) {
            $resTable = trim((string) $reservation->table_number);

            if (strcasecmp($resTable, $table) !== 0) {
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
