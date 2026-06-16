<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\ReservationTransaction;
use App\Models\Venue;
use App\Mail\ReservationReminderMail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class SendReservationRemindersTest extends TestCase
{
    use RefreshDatabase;

    private Venue $venue;

    protected function setUp(): void
    {
        parent::setUp();

        $this->venue = Venue::create([
            'name' => 'Grand Ballroom',
            'slug' => 'grand-ballroom',
            'wing' => 'Main Wing',
            'type' => 'function room',
            'capacity' => 500,
            'is_active' => true,
            'is_visible' => true,
            'reservations_enabled' => true,
        ]);
    }

    public function test_sends_reminders_only_to_confirmed_reservations_scheduled_for_today(): void
    {
        Mail::fake();

        // 1. Confirmed reservation for today (should get reminder)
        $confirmedToday = Reservation::create([
            'reference_code' => '2026-0001',
            'name' => 'Today Guest',
            'email' => 'today@example.com',
            'phone' => '09170000001',
            'venue_id' => $this->venue->id,
            'room' => $this->venue->name,
            'table_number' => 'T1',
            'seat_number' => '1',
            'guests_count' => 1,
            'event_date' => Carbon::today()->format('Y-m-d'),
            'event_time' => '18:00',
            'status' => 'reserved',
            'type' => 'individual',
            'submitted_at' => now(),
        ]);

        // 2. Pending reservation for today (should be ignored)
        $pendingToday = Reservation::create([
            'reference_code' => '2026-0002',
            'name' => 'Pending Guest',
            'email' => 'pending@example.com',
            'phone' => '09170000002',
            'venue_id' => $this->venue->id,
            'room' => $this->venue->name,
            'table_number' => 'T1',
            'seat_number' => '2',
            'guests_count' => 1,
            'event_date' => Carbon::today()->format('Y-m-d'),
            'event_time' => '18:00',
            'status' => 'pending',
            'type' => 'individual',
            'submitted_at' => now(),
        ]);

        // 3. Confirmed reservation for tomorrow (should be ignored)
        $confirmedTomorrow = Reservation::create([
            'reference_code' => '2026-0003',
            'name' => 'Tomorrow Guest',
            'email' => 'tomorrow@example.com',
            'phone' => '09170000003',
            'venue_id' => $this->venue->id,
            'room' => $this->venue->name,
            'table_number' => 'T2',
            'seat_number' => '1',
            'guests_count' => 1,
            'event_date' => Carbon::tomorrow()->format('Y-m-d'),
            'event_time' => '18:00',
            'status' => 'approved',
            'type' => 'individual',
            'submitted_at' => now(),
        ]);

        // Run the command
        Artisan::call('reservations:send-reminders');

        // Assert reminder mail was sent to today's confirmed guest
        Mail::assertSent(ReservationReminderMail::class, function (ReservationReminderMail $mail) use ($confirmedToday) {
            return $mail->hasTo('today@example.com') && $mail->reservation->id === $confirmedToday->id;
        });

        // Assert no reminder emails were sent to the pending or tomorrow guests
        Mail::assertNotSent(ReservationReminderMail::class, function (ReservationReminderMail $mail) {
            return $mail->hasTo('pending@example.com') || $mail->hasTo('tomorrow@example.com');
        });

        // Assert transaction was recorded for today's guest
        $this->assertTrue(
            ReservationTransaction::where('reservation_id', $confirmedToday->id)
                ->where('action', 'reminder_sent')
                ->exists()
        );

        // Assert no transaction was recorded for other guests
        $this->assertFalse(
            ReservationTransaction::where('reservation_id', $pendingToday->id)
                ->where('action', 'reminder_sent')
                ->exists()
        );
    }

    public function test_prevents_duplicate_reminders_on_the_same_day(): void
    {
        Mail::fake();

        $reservation = Reservation::create([
            'reference_code' => '2026-0004',
            'name' => 'Duplicate Guest',
            'email' => 'duplicate@example.com',
            'phone' => '09170000004',
            'venue_id' => $this->venue->id,
            'room' => $this->venue->name,
            'table_number' => 'T1',
            'seat_number' => '1',
            'guests_count' => 1,
            'event_date' => Carbon::today()->format('Y-m-d'),
            'event_time' => '18:00',
            'status' => 'reserved',
            'type' => 'individual',
            'submitted_at' => now(),
        ]);

        // Run command first time (should send email)
        Artisan::call('reservations:send-reminders');

        Mail::assertSent(ReservationReminderMail::class, 1);

        // Run command second time (should be skipped due to existing transaction)
        Artisan::call('reservations:send-reminders');

        // Total sends should still be 1
        Mail::assertSent(ReservationReminderMail::class, 1);
    }
}
