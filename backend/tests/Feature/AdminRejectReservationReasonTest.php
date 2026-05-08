<?php

namespace Tests\Feature;

use App\Mail\ReservationStatusMail;
use App\Models\Admin;
use App\Models\Reservation;
use App\Models\Venue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AdminRejectReservationReasonTest extends TestCase
{
    use RefreshDatabase;

    private function createVenue(): Venue
    {
        return Venue::create([
            'name' => 'Main Hall',
            'wing' => 'Main Wing',
            'type' => 'function room',
            'capacity' => 50,
            'price_per_hour' => 1000,
            'description' => 'Primary venue',
            'is_active' => true,
        ]);
    }

    private function createReservation(Venue $venue, array $overrides = []): Reservation
    {
        static $sequence = 1;

        $defaults = [
            'reference_code' => sprintf('2026-%04d', $sequence),
            'name' => 'Test Guest ' . $sequence,
            'email' => 'guest' . $sequence . '@example.com',
            'phone' => '09171234' . str_pad((string) $sequence, 3, '0', STR_PAD_LEFT),
            'venue_id' => $venue->id,
            'table_number' => 'T' . $sequence,
            'seat_number' => 'S' . $sequence,
            'guests_count' => 4,
            'event_date' => now()->addDay()->format('Y-m-d H:i:s'),
            'event_time' => '18:00',
            'special_requests' => null,
            'status' => 'pending',
            'type' => 'whole',
            'submitted_at' => now(),
        ];

        $sequence++;

        return Reservation::create(array_merge($defaults, $overrides));
    }

    private function adminHeaders(string $role = 'admin', string $scopeType = 'all', array $outletScope = []): array
    {
        static $sequence = 1;

        $admin = Admin::create([
            'name' => 'Test Admin ' . $sequence,
            'email' => 'admin' . $sequence . '@example.com',
            'username' => 'admin' . $sequence,
            'password' => 'password123',
            'role' => $role,
            'scope_type' => $scopeType,
            'outlet_scope' => $outletScope,
        ]);
        $sequence++;

        $response = $this->postJson('/api/auth/login', [
            'username' => $admin->username,
            'password' => 'password123',
        ])->assertOk();

        return [
            'Authorization' => 'Bearer ' . $response->json('token'),
        ];
    }

    public function test_admin_reservation_notifications_send_for_reserved_and_rejected_states(): void
    {
        Mail::fake();

        $venue = $this->createVenue();

        $rejectedReservation = $this->createReservation($venue);
        $reservedReservation = $this->createReservation($venue, [
            'name' => 'Second Guest',
            'guests_count' => 2,
            'event_date' => now()->addDays(2)->format('Y-m-d H:i:s'),
            'event_time' => '19:00',
        ]);

        $headers = $this->adminHeaders();

        $this->patchJson("/api/admin/reservations/{$rejectedReservation->id}/reject", [], $headers)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['reason']);

        $this->patchJson("/api/admin/reservations/{$rejectedReservation->id}/reject", [
            'reason' => 'Venue is fully booked for that date',
        ], $headers)
            ->assertOk()
            ->assertJsonFragment([
                'success' => true,
                'message' => 'Reservation rejected successfully',
            ]);

        $this->patchJson("/api/admin/reservations/{$reservedReservation->id}/approve", [], $headers)
            ->assertOk()
            ->assertJsonFragment([
                'success' => true,
                'message' => 'Reservation approved successfully',
            ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $rejectedReservation->id,
            'status' => 'rejected',
            'rejection_reason' => 'Venue is fully booked for that date',
        ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservedReservation->id,
            'status' => 'reserved',
        ]);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $rejectedReservation->id,
            'action' => 'status_changed',
            'from_status' => 'pending',
            'to_status' => 'rejected',
        ]);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservedReservation->id,
            'action' => 'status_changed',
            'from_status' => 'pending',
            'to_status' => 'reserved',
        ]);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservedReservation->id,
            'action' => 'notification_sent',
            'to_status' => 'reserved',
        ]);

        Mail::assertSent(ReservationStatusMail::class, function (ReservationStatusMail $mail) use ($rejectedReservation) {
            return $mail->status === 'rejected'
                && $mail->rejectionReason === 'Venue is fully booked for that date'
                && (int) $mail->reservation->id === (int) $rejectedReservation->id;
        });

        Mail::assertSent(ReservationStatusMail::class, function (ReservationStatusMail $mail) use ($reservedReservation) {
            return $mail->status === 'reserved'
                && (int) $mail->reservation->id === (int) $reservedReservation->id;
        });
    }

    public function test_client_cancel_sends_cancelled_mail_with_distinct_message_context(): void
    {
        Mail::fake();

        $venue = $this->createVenue();
        $reservation = $this->createReservation($venue, [
            'name' => 'Guest To Cancel',
            'status' => 'approved',
        ]);

        $this->patchJson("/api/reservations/{$reservation->id}/reject", [
            'reason' => 'Unable to attend due to schedule conflict',
        ])
            ->assertOk()
            ->assertJsonFragment([
                'success' => true,
                'message' => 'Booking cancelled successfully',
            ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'rejected',
            'cancellation_reason' => 'Unable to attend due to schedule conflict',
        ]);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservation->id,
            'action' => 'status_changed',
            'from_status' => 'approved',
            'to_status' => 'rejected',
        ]);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservation->id,
            'action' => 'notification_sent',
            'to_status' => 'rejected',
        ]);

        Mail::assertSent(ReservationStatusMail::class, function (ReservationStatusMail $mail) use ($reservation) {
            return $mail->status === 'cancelled'
                && $mail->rejectionReason === 'Unable to attend due to schedule conflict'
                && (int) $mail->reservation->id === (int) $reservation->id;
        });

        Mail::assertNotSent(ReservationStatusMail::class, function (ReservationStatusMail $mail) use ($reservation) {
            return (int) $mail->reservation->id === (int) $reservation->id
                && $mail->status === 'rejected';
        });
    }

    public function test_admin_can_revert_rejected_reservation_to_pending_with_status_tracking(): void
    {
        Mail::fake();

        $venue = $this->createVenue();
        $reservation = $this->createReservation($venue);
        $headers = $this->adminHeaders();

        $this->patchJson("/api/admin/reservations/{$reservation->id}/reject", [
            'reason' => 'Venue is fully booked for that date',
        ], $headers)->assertOk();

        $this->patchJson("/api/admin/reservations/{$reservation->id}/revert", [], $headers)
            ->assertOk()
            ->assertJsonFragment([
                'success' => true,
                'message' => 'Reservation reverted to pending successfully',
                'status' => 'pending',
                'reservation_state' => 'active',
                'previous_status' => 'rejected',
            ]);

        $reservation->refresh();

        $this->assertSame('pending', $reservation->status);
        $this->assertSame('active', $reservation->reservation_state);
        $this->assertSame('rejected', $reservation->previous_status);
        $this->assertNotNull($reservation->rejected_at);
        $this->assertNotNull($reservation->reverted_at);
        $this->assertNotNull($reservation->status_last_changed_at);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservation->id,
            'action' => 'status_changed',
            'from_status' => 'rejected',
            'to_status' => 'pending',
        ]);
    }

    public function test_admin_modifications_require_manage_reservation_permission(): void
    {
        Mail::fake();

        $venue = $this->createVenue();
        $reservation = $this->createReservation($venue);

        $this->patchJson("/api/admin/reservations/{$reservation->id}/approve")
            ->assertUnauthorized();

        $viewerHeaders = $this->adminHeaders('fb_director');

        $this->getJson('/api/admin/reservations', $viewerHeaders)
            ->assertOk();

        $this->patchJson("/api/admin/reservations/{$reservation->id}/approve", [], $viewerHeaders)
            ->assertForbidden()
            ->assertJsonFragment([
                'message' => 'You are not authorized to perform this action.',
            ]);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'pending',
        ]);
    }

    public function test_outlet_manager_access_is_limited_to_assigned_outlets(): void
    {
        Mail::fake();

        $firstVenue = $this->createVenue();
        $secondVenue = Venue::create([
            'name' => 'Second Hall',
            'wing' => 'Dining',
            'type' => 'dining',
            'capacity' => 40,
            'price_per_hour' => 1500,
            'description' => 'Second venue',
            'is_active' => true,
        ]);

        $ownReservation = $this->createReservation($firstVenue);
        $otherReservation = $this->createReservation($secondVenue);
        $headers = $this->adminHeaders('outlet_manager', 'assigned', [$firstVenue->id]);

        $this->getJson('/api/admin/reservations/stats', $headers)
            ->assertOk()
            ->assertJsonFragment([
                'total' => 1,
            ]);

        $this->patchJson("/api/admin/reservations/{$ownReservation->id}/approve", [], $headers)
            ->assertOk();

        $this->patchJson("/api/admin/reservations/{$otherReservation->id}/approve", [], $headers)
            ->assertForbidden()
            ->assertJsonFragment([
                'message' => 'You are not authorized to access this outlet.',
            ]);
    }

    public function test_account_creation_respects_role_hierarchy(): void
    {
        $adminHeaders = $this->adminHeaders('admin');

        $this->postJson('/api/admin/accounts', [
            'name' => 'Blocked Super Admin',
            'email' => 'blocked.super@example.com',
            'username' => 'blocked.super@example.com',
            'password' => 'password123',
            'role' => 'super_admin',
            'scope_type' => 'all',
            'outlet_scope' => [],
        ], $adminHeaders)->assertStatus(422);

        $this->postJson('/api/admin/accounts', [
            'name' => 'Allowed Staff',
            'email' => 'allowed.staff@example.com',
            'username' => 'allowed.staff@example.com',
            'password' => 'password123',
            'role' => 'staff',
            'scope_type' => 'assigned',
            'outlet_scope' => [1],
        ], $adminHeaders)
            ->assertCreated()
            ->assertJsonFragment([
                'message' => 'Admin account created successfully.',
                'role' => 'staff',
            ]);

        $staffHeaders = $this->adminHeaders('staff');

        $this->getJson('/api/admin/accounts', $staffHeaders)
            ->assertForbidden();
    }

    public function test_outlet_reports_respect_role_and_outlet_scope(): void
    {
        $firstVenue = $this->createVenue();
        $secondVenue = Venue::create([
            'name' => 'Second Hall',
            'wing' => 'Dining',
            'type' => 'dining',
            'capacity' => 40,
            'price_per_hour' => 1500,
            'description' => 'Second venue',
            'is_active' => true,
        ]);

        $this->createReservation($firstVenue, ['status' => 'reserved']);
        $this->createReservation($secondVenue, [
            'status' => 'pending',
            'room' => 'Second Hall',
            'special_requests' => 'Use birthday promo package.',
        ]);

        $directorHeaders = $this->adminHeaders('fb_director');

        $this->getJson('/api/admin/reports/outlets', $directorHeaders)
            ->assertOk()
            ->assertJsonPath('summary.reservations', 2)
            ->assertJsonPath('summary.dine_in', 1)
            ->assertJsonPath('summary.promotion_mentions', 1)
            ->assertJsonPath('status_breakdown.pending', 1)
            ->assertJsonPath('category_breakdown.dine_in.reservations', 1)
            ->assertJsonFragment([
                'room' => 'Second Hall',
                'promotion_mentions' => 1,
            ]);

        $managerHeaders = $this->adminHeaders('outlet_manager', 'assigned', [$firstVenue->id]);

        $this->getJson('/api/admin/reports/outlets', $managerHeaders)
            ->assertOk()
            ->assertJsonPath('summary.reservations', 1)
            ->assertJsonFragment([
                'venue_id' => $firstVenue->id,
            ]);

        $staffHeaders = $this->adminHeaders('staff');

        $this->getJson('/api/admin/reports/outlets', $staffHeaders)
            ->assertForbidden();
    }
}
