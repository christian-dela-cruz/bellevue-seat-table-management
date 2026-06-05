<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Reservation;
use App\Models\Venue;
use Illuminate\Support\Str;

class ReservationSeeder extends Seeder
{
    public function run(): void
    {
        $venues = Venue::all();
        
        if ($venues->isEmpty()) {
            return;
        }

        // List of venues to distribute reservations across
        $venueNames = [
            'Pastry Corner',
            'Vue Bar',
            'Johnny\'s Steak and Grill',
            'Phoenix Court',
            'Hanakazu Japanese Restaurant',
            'Qsina Restaurant',
            'Alabang Function Room',
            'Laguna Ballroom',
            'Grand Ballroom A',
            'Tower 1',
            'Business Center',
            '20/20 Function Room A',
            '20/20 Function Room B',
            '20/20 Function Room C',
        ];

        $reservationsData = [
            [
                'name' => 'Raphael Katigbak',
                'email' => 'raphael@example.com',
                'phone' => '09171234567',
                'guests_count' => 4,
                'event_date' => '2026-07-15 18:30:00',
                'event_time' => '6:30 PM',
                'status' => 'approved',
                'type' => 'whole',
                'table_number' => 'T1',
                'seat_number' => null,
            ],
            [
                'name' => 'Japi Balboa',
                'email' => 'japi@example.com',
                'phone' => '09172345678',
                'guests_count' => 2,
                'event_date' => '2026-07-16 19:00:00',
                'event_time' => '7:00 PM',
                'status' => 'pending',
                'type' => 'individual',
                'table_number' => 'T2',
                'seat_number' => 'Seat 1,Seat 2',
            ],
            [
                'name' => 'Mary Dela Cruz',
                'email' => 'mary@example.com',
                'phone' => '09173456789',
                'guests_count' => 10,
                'event_date' => '2026-07-18 12:00:00',
                'event_time' => '12:00 PM',
                'status' => 'approved',
                'type' => 'whole',
                'table_number' => 'T1',
                'seat_number' => null,
            ],
            [
                'name' => 'Raven Adalla',
                'email' => 'raven@example.com',
                'phone' => '09174567890',
                'guests_count' => 1,
                'event_date' => '2026-07-20 09:00:00',
                'event_time' => '9:00 AM',
                'status' => 'rejected',
                'type' => 'individual',
                'table_number' => 'T3',
                'seat_number' => 'Seat 5',
            ],
            [
                'name' => 'Marc Caranay',
                'email' => 'marc@example.com',
                'phone' => '09175678901',
                'guests_count' => 5,
                'event_date' => '2026-07-22 18:00:00',
                'event_time' => '6:00 PM',
                'status' => 'pending',
                'type' => 'whole',
                'table_number' => 'T2',
                'seat_number' => null,
            ],
            [
                'name' => 'Patrick Paguio',
                'email' => 'patrick@example.com',
                'phone' => '09176789012',
                'guests_count' => 6,
                'event_date' => '2026-07-25 19:30:00',
                'event_time' => '7:30 PM',
                'status' => 'approved',
                'type' => 'whole',
                'table_number' => 'T1',
                'seat_number' => null,
            ],
            [
                'name' => 'Netanya Bautista',
                'email' => 'netanya@example.com',
                'phone' => '09177890123',
                'guests_count' => 2,
                'event_date' => '2026-07-28 11:30:00',
                'event_time' => '11:30 AM',
                'status' => 'approved',
                'type' => 'individual',
                'table_number' => 'T4',
                'seat_number' => 'Seat 3,Seat 4',
            ],
            [
                'name' => 'Vessna Gregana',
                'email' => 'vessna@example.com',
                'phone' => '09178901234',
                'guests_count' => 8,
                'event_date' => '2026-08-01 18:00:00',
                'event_time' => '6:00 PM',
                'status' => 'pending',
                'type' => 'whole',
                'table_number' => 'T1',
                'seat_number' => null,
            ],
            [
                'name' => 'Jewyz Bunyi',
                'email' => 'jewyz@example.com',
                'phone' => '09179012345',
                'guests_count' => 4,
                'event_date' => '2026-08-05 19:00:00',
                'event_time' => '7:00 PM',
                'status' => 'approved',
                'type' => 'whole',
                'table_number' => 'T2',
                'seat_number' => null,
            ],
            [
                'name' => 'Pao Baltazar',
                'email' => 'pao@example.com',
                'phone' => '09170123456',
                'guests_count' => 2,
                'event_date' => '2026-08-10 20:00:00',
                'event_time' => '8:00 PM',
                'status' => 'approved',
                'type' => 'individual',
                'table_number' => 'T1',
                'seat_number' => 'Seat 1,Seat 2',
            ],
            [
                'name' => 'Lea Gonzales',
                'email' => 'lea@example.com',
                'phone' => '09181234567',
                'guests_count' => 5,
                'event_date' => '2026-08-12 12:00:00',
                'event_time' => '12:00 PM',
                'status' => 'pending',
                'type' => 'whole',
                'table_number' => 'T1',
                'seat_number' => null,
            ],
            [
                'name' => 'Von Orlino',
                'email' => 'von@example.com',
                'phone' => '09182345678',
                'guests_count' => 3,
                'event_date' => '2026-08-15 14:00:00',
                'event_time' => '2:00 PM',
                'status' => 'approved',
                'type' => 'individual',
                'table_number' => 'T2',
                'seat_number' => 'Seat 3,Seat 4,Seat 5',
            ],
            [
                'name' => 'Jam Orlino',
                'email' => 'jam@example.com',
                'phone' => '09183456789',
                'guests_count' => 12,
                'event_date' => '2026-08-18 18:00:00',
                'event_time' => '6:00 PM',
                'status' => 'rejected',
                'type' => 'whole',
                'table_number' => 'T3',
                'seat_number' => null,
            ],
            [
                'name' => 'Jep Javate',
                'email' => 'jep@example.com',
                'phone' => '09184567890',
                'guests_count' => 2,
                'event_date' => '2026-08-20 19:00:00',
                'event_time' => '7:00 PM',
                'status' => 'approved',
                'type' => 'whole',
                'table_number' => 'T1',
                'seat_number' => null,
            ],
        ];

        foreach ($reservationsData as $index => $reservation) {
            $venueName = $venueNames[$index % count($venueNames)];
            $venue = $venues->where('name', $venueName)->first() ?? $venues->first();

            Reservation::create([
                'reference_code' => date('Y') . '-' . str_pad(mt_rand(1, 9999), 4, '0', STR_PAD_LEFT),
                'venue_id' => $venue->id,
                'special_requests' => 'None',
                'consent_accepted' => true,
                'submitted_at' => now()->subDays(rand(1, 14)),
                ...$reservation,
            ]);
        }
    }
}
