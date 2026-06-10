<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\Venue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationValidationTest extends TestCase
{
    use RefreshDatabase;

    private function createVenueWithLayout(string $name = 'Test Venue'): Venue
    {
        $payload = [
            'v' => 2,
            'tables' => [
                [
                    'id' => 'T1',
                    'seats' => [
                        ['id' => '1', 'num' => '1', 'status' => 'available', 'x' => 10, 'y' => 10],
                        ['id' => '2', 'num' => '2', 'status' => 'available', 'x' => 20, 'y' => 10],
                    ],
                ],
                [
                    'id' => 'T2',
                    'seats' => [
                        ['id' => '1', 'num' => '1', 'status' => 'available', 'x' => 30, 'y' => 10],
                        ['id' => '2', 'num' => '2', 'status' => 'available', 'x' => 40, 'y' => 10],
                    ],
                ]
            ],
            'standaloneSeats' => [
                ['id' => 'S1', 'num' => 'S1', 'status' => 'available', 'x' => 50, 'y' => 10],
                ['id' => 'S2', 'num' => 'S2', 'status' => 'available', 'x' => 60, 'y' => 10],
            ],
        ];

        $venue = Venue::create([
            'name' => $name,
            'slug' => \Illuminate\Support\Str::slug($name),
            'wing' => 'Main Wing',
            'type' => 'function room',
            'capacity' => 50,
            'is_active' => true,
            'is_visible' => true,
            'reservations_enabled' => true,
        ]);

        \App\Models\SeatMap::create([
            'venue_id' => $venue->id,
            'status' => 'published',
            'payload' => $payload,
            'version_number' => 1,
            'published_at' => now(),
        ]);

        return $venue;
    }

    public function test_seatmap_resolves_correct_available_pending_and_unavailable_states(): void
    {
        $venue = $this->createVenueWithLayout('Grand Ballroom A');

        // Initially, all tables and seats should be available
        $response = $this->getJson("/api/rooms/{$venue->id}/seats?event_date=2026-06-24&event_time=18:00")
            ->assertOk();

        $data = $response->json('data');
        $this->assertEquals('available', $data['tables'][0]['seats'][0]['status']);
        $this->assertEquals('available', $data['tables'][0]['seats'][1]['status']);
        $this->assertEquals('available', $data['standaloneSeats'][0]['status']);
        $this->assertEquals('available', $data['standaloneSeats'][1]['status']);
        $this->assertTrue($response->json('availability.available'));

        // 1. Pending state: Create a pending reservation on Table T1, Seat 1
        Reservation::create([
            'reference_code' => '2026-0001',
            'name' => 'Pending Guest',
            'email' => 'pending@example.com',
            'phone' => '09170000001',
            'venue_id' => $venue->id,
            'room' => $venue->name,
            'table_number' => 'T1',
            'seat_number' => '1',
            'guests_count' => 1,
            'event_date' => '2026-06-24',
            'event_time' => '18:00',
            'status' => 'pending',
            'type' => 'individual',
            'submitted_at' => now(),
        ]);

        // 2. Unavailable state: Create a confirmed/reserved reservation on Table T1, Seat 2
        Reservation::create([
            'reference_code' => '2026-0002',
            'name' => 'Reserved Guest',
            'email' => 'reserved@example.com',
            'phone' => '09170000002',
            'venue_id' => $venue->id,
            'room' => $venue->name,
            'table_number' => 'T1',
            'seat_number' => '2',
            'guests_count' => 1,
            'event_date' => '2026-06-24',
            'event_time' => '18:00',
            'status' => 'reserved',
            'type' => 'individual',
            'submitted_at' => now(),
        ]);

        // Query the seatmap and check states
        $response = $this->getJson("/api/rooms/{$venue->id}/seats?event_date=2026-06-24&event_time=18:00")
            ->assertOk();

        $data = $response->json('data');
        // Seat 1 is pending
        $this->assertEquals('pending', $data['tables'][0]['seats'][0]['status']);
        // Seat 2 is unavailable
        $this->assertEquals('unavailable', $data['tables'][0]['seats'][1]['status']);
        // Table T2 and standalone seats remain available
        $this->assertEquals('available', $data['tables'][1]['seats'][0]['status']);
        $this->assertEquals('available', $data['standaloneSeats'][0]['status']);
        
        // The venue room itself is still available since the whole venue is not booked
        $this->assertTrue($response->json('availability.available'));
    }

    public function test_reservations_are_scoped_by_date_time_and_venue(): void
    {
        $venue1 = $this->createVenueWithLayout('Venue One');
        $venue2 = $this->createVenueWithLayout('Venue Two');

        // Create a booking on Venue 1 at Date1 Time1
        Reservation::create([
            'reference_code' => '2026-0003',
            'name' => 'Guest',
            'email' => 'guest@example.com',
            'phone' => '09170000003',
            'venue_id' => $venue1->id,
            'room' => $venue1->name,
            'table_number' => 'T1',
            'seat_number' => '1',
            'guests_count' => 1,
            'event_date' => '2026-06-24',
            'event_time' => '18:00',
            'status' => 'reserved',
            'type' => 'individual',
            'submitted_at' => now(),
        ]);

        // Query Venue 1 on a DIFFERENT Date -> should be available
        $this->getJson("/api/rooms/{$venue1->id}/seats?event_date=2026-06-25&event_time=18:00")
            ->assertJsonPath('data.tables.0.seats.0.status', 'available');

        // Query Venue 1 on a DIFFERENT Time -> should be available
        $this->getJson("/api/rooms/{$venue1->id}/seats?event_date=2026-06-24&event_time=19:00")
            ->assertJsonPath('data.tables.0.seats.0.status', 'available');

        // Query Venue 2 on the SAME Date and Time -> should be available
        $this->getJson("/api/rooms/{$venue2->id}/seats?event_date=2026-06-24&event_time=18:00")
            ->assertJsonPath('data.tables.0.seats.0.status', 'available');

        // Query Venue 1 on the SAME Date and Time -> should be unavailable
        $this->getJson("/api/rooms/{$venue1->id}/seats?event_date=2026-06-24&event_time=18:00")
            ->assertJsonPath('data.tables.0.seats.0.status', 'unavailable');
    }

    public function test_double_booking_conflict_prevention(): void
    {
        $venue = $this->createVenueWithLayout('Venue Block Test');

        // Create a reservation for T1 Seat 1
        Reservation::create([
            'reference_code' => '2026-0004',
            'name' => 'First Booker',
            'email' => 'first@example.com',
            'phone' => '09170000004',
            'venue_id' => $venue->id,
            'room' => $venue->name,
            'table_number' => 'T1',
            'seat_number' => '1',
            'guests_count' => 1,
            'event_date' => '2026-06-24',
            'event_time' => '18:00',
            'status' => 'pending',
            'type' => 'individual',
            'submitted_at' => now(),
        ]);

        // Attempting to book the SAME seat on the SAME date/time should be blocked
        $payload = [
            'name' => 'Second Booker',
            'email' => 'second@example.com',
            'phone' => '09170000005',
            'venue_id' => $venue->id,
            'room' => $venue->name,
            'table_number' => 'T1',
            'seat_number' => '1',
            'guests_count' => 1,
            'event_date' => '2026-06-24',
            'event_time' => '18:00',
            'type' => 'individual',
        ];

        $response = $this->postJson('/api/reservations', $payload)
            ->assertStatus(422);

        $this->assertEquals(
            'This seat or table is no longer available for the selected schedule. Please choose another option.',
            $response->json('message')
        );

        // Booking a different seat (Seat 2) should succeed
        $payload['seat_number'] = '2';
        $this->postJson('/api/reservations', $payload)
            ->assertStatus(201);
    }

    public function test_standalone_seats_can_be_reserved_and_checked(): void
    {
        $venue = $this->createVenueWithLayout('Standalone Outlet');

        // Reserve Standalone seat S1
        $payload = [
            'name' => 'Standalone Guest',
            'email' => 'standalone@example.com',
            'phone' => '09170000006',
            'venue_id' => $venue->id,
            'room' => $venue->name,
            'table_number' => 'STANDALONE',
            'seat_number' => 'S1',
            'guests_count' => 1,
            'event_date' => '2026-06-24',
            'event_time' => '18:00',
            'type' => 'standalone',
        ];

        $this->postJson('/api/reservations', $payload)
            ->assertStatus(201);

        // Check seatmap state
        $response = $this->getJson("/api/rooms/{$venue->id}/seats?event_date=2026-06-24&event_time=18:00")
            ->assertOk();

        // Standalone seat S1 should be pending (default new reservation status)
        $this->assertEquals('pending', $response->json('data.standaloneSeats.0.status'));
        // Standalone seat S2 should remain available
        $this->assertEquals('available', $response->json('data.standaloneSeats.1.status'));
    }

    public function test_whole_table_booking_blocks_entire_table(): void
    {
        $venue = $this->createVenueWithLayout('Table Block Outlet');

        // Reserve the whole Table T1
        $payload = [
            'name' => 'Table Guest',
            'email' => 'table@example.com',
            'phone' => '09170000007',
            'venue_id' => $venue->id,
            'room' => $venue->name,
            'table_number' => 'T1',
            'seat_number' => '1,2',
            'guests_count' => 2,
            'event_date' => '2026-06-24',
            'event_time' => '18:00',
            'type' => 'whole',
        ];

        $this->postJson('/api/reservations', $payload)
            ->assertStatus(201);

        // Check seatmap state
        $response = $this->getJson("/api/rooms/{$venue->id}/seats?event_date=2026-06-24&event_time=18:00")
            ->assertOk();

        // Both seats of Table T1 should show pending (since new booking is pending status)
        $this->assertEquals('pending', $response->json('data.tables.0.seats.0.status'));
        $this->assertEquals('pending', $response->json('data.tables.0.seats.1.status'));
        
        // Table T2 remains available
        $this->assertEquals('available', $response->json('data.tables.1.seats.0.status'));
    }

    public function test_whole_venue_booking_blocks_entire_venue(): void
    {
        $venue = $this->createVenueWithLayout('Whole Venue Outlet');

        // Reserve the entire venue
        $payload = [
            'name' => 'VIP Event',
            'email' => 'vip@example.com',
            'phone' => '09170000008',
            'venue_id' => $venue->id,
            'room' => $venue->name,
            'table_number' => 'WHOLE',
            'seat_number' => '',
            'guests_count' => 50,
            'event_date' => '2026-06-24',
            'event_time' => '18:00',
            'type' => 'whole',
        ];

        $this->postJson('/api/reservations', $payload)
            ->assertStatus(201);

        // Check seatmap state
        $response = $this->getJson("/api/rooms/{$venue->id}/seats?event_date=2026-06-24&event_time=18:00")
            ->assertOk();

        // The whole venue should show as unavailable
        $this->assertFalse($response->json('availability.available'));
        $this->assertEquals('pending', $response->json('availability.status'));
    }

    public function test_seatmap_merges_availability_by_seat_number_fallback(): void
    {
        $venue = $this->createVenueWithLayout('Hanakazu Outlet Test');

        // Create a reservation where seat_number is '1' (stored as a numeric string)
        Reservation::create([
            'reference_code' => '2026-0009',
            'name' => 'Hanakazu Guest',
            'email' => 'hanakazu@example.com',
            'phone' => '09170000009',
            'venue_id' => $venue->id,
            'room' => $venue->name,
            'table_number' => 'T1',
            'seat_number' => '1',
            'guests_count' => 1,
            'event_date' => '2026-06-24',
            'event_time' => '18:00',
            'status' => 'pending',
            'type' => 'individual',
            'submitted_at' => now(),
        ]);

        // Query the seatmap
        $response = $this->getJson("/api/rooms/{$venue->id}/seats?event_date=2026-06-24&event_time=18:00")
            ->assertOk();

        // The seat in layout has ID 'T1-S1' and num 1. It should map to 'pending' because num matches.
        $this->assertEquals('pending', $response->json('data.tables.0.seats.0.status'));
        $this->assertEquals('available', $response->json('data.tables.0.seats.1.status'));
    }
}
