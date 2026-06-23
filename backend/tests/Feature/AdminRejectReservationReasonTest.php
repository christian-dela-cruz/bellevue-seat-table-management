<?php

namespace Tests\Feature;

use App\Mail\ReservationStatusMail;
use App\Models\Admin;
use App\Models\Reservation;
use App\Models\ReservationTransaction;
use App\Models\Seat;
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
            'action' => 'rejected',
            'from_status' => 'pending',
            'to_status' => 'rejected',
        ]);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservedReservation->id,
            'action' => 'approved',
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
            'status' => 'cancelled',
            'cancellation_reason' => 'Unable to attend due to schedule conflict',
        ]);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservation->id,
            'action' => 'cancelled_by_guest',
            'from_status' => 'approved',
            'to_status' => 'cancelled',
        ]);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservation->id,
            'action' => 'notification_sent',
            'to_status' => 'cancelled',
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
            'action' => 'reverted',
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
        Admin::create([
            'name' => 'Existing Super Admin',
            'email' => 'existing.super@example.com',
            'username' => 'existing.super@example.com',
            'password' => 'password123',
            'role' => 'super_admin',
            'scope_type' => 'all',
            'outlet_scope' => [],
        ]);

        $adminHeaders = $this->adminHeaders('admin');

        $this->getJson('/api/admin/accounts', $adminHeaders)
            ->assertOk()
            ->assertJsonMissing([
                'role' => 'super_admin',
            ]);

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
            'name' => 'Blocked Admin',
            'email' => 'blocked.admin@example.com',
            'username' => 'blocked.admin@example.com',
            'password' => 'password123',
            'role' => 'admin',
            'scope_type' => 'all',
            'outlet_scope' => [],
        ], $adminHeaders)->assertStatus(422);

        $this->postJson('/api/admin/accounts', [
            'name' => 'Allowed Supervisor',
            'email' => 'allowed.supervisor@example.com',
            'username' => 'allowed.supervisor@example.com',
            'password' => 'password123',
            'role' => 'supervisor',
            'scope_type' => 'assigned',
            'outlet_scope' => [1],
        ], $adminHeaders)
            ->assertCreated()
            ->assertJsonFragment([
                'message' => 'Admin account created successfully. Invitation email sent.',
                'role' => 'supervisor',
                'scope_type' => 'assigned',
            ]);

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
                'message' => 'Admin account created successfully. Invitation email sent.',
                'role' => 'staff',
            ]);

        $staffHeaders = $this->adminHeaders('staff');

        $this->getJson('/api/admin/accounts', $staffHeaders)
            ->assertForbidden();
    }

    public function test_account_modification_and_deactivation_respect_peer_role_boundaries(): void
    {
        $otherSuper = Admin::create([
            'name' => 'Other Super',
            'email' => 'other.super@example.com',
            'username' => 'other.super@example.com',
            'password' => 'password123',
            'role' => 'super_admin',
            'scope_type' => 'all',
            'outlet_scope' => [],
        ]);
        $peerAdmin = Admin::create([
            'name' => 'Peer Admin',
            'email' => 'peer.admin@example.com',
            'username' => 'peer.admin@example.com',
            'password' => 'password123',
            'role' => 'admin',
            'scope_type' => 'all',
            'outlet_scope' => [],
        ]);
        $staff = Admin::create([
            'name' => 'Target Staff',
            'email' => 'target.staff@example.com',
            'username' => 'target.staff@example.com',
            'password' => 'password123',
            'role' => 'staff',
            'scope_type' => 'all',
            'outlet_scope' => [],
        ]);

        $superHeaders = $this->adminHeaders('super_admin');
        $adminHeaders = $this->adminHeaders('admin');

        $this->putJson("/api/admin/accounts/{$otherSuper->id}", [
            'name' => 'Changed Super',
        ], $superHeaders)->assertForbidden();

        $this->putJson("/api/admin/accounts/{$peerAdmin->id}", [
            'name' => 'Changed Admin',
        ], $adminHeaders)->assertForbidden();

        $this->patchJson("/api/admin/accounts/{$staff->id}/deactivate", [], $adminHeaders)
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('admins', [
            'id' => $staff->id,
            'is_active' => false,
        ]);

        $this->postJson('/api/auth/login', [
            'username' => 'target.staff@example.com',
            'password' => 'password123',
        ])->assertUnauthorized();

        $this->patchJson("/api/admin/accounts/{$staff->id}/reactivate", [], $adminHeaders)
            ->assertOk()
            ->assertJsonPath('data.is_active', true);
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

        $directorHeaders = $this->adminHeaders('fb_director', 'assigned', [$firstVenue->id]);

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
            ])
            ->assertJsonMissing([
                'name' => 'Second Hall',
            ]);

        $supervisorHeaders = $this->adminHeaders('supervisor', 'assigned', [$firstVenue->id]);

        $this->getJson('/api/admin/reports/outlets', $supervisorHeaders)
            ->assertOk()
            ->assertJsonPath('summary.reservations', 1)
            ->assertJsonFragment([
                'venue_id' => $firstVenue->id,
            ])
            ->assertJsonMissing([
                'name' => 'Second Hall',
            ]);

        $staffHeaders = $this->adminHeaders('staff');

        $this->getJson('/api/admin/reports/outlets', $staffHeaders)
            ->assertForbidden();
    }

    public function test_transaction_reports_allow_global_view_for_fb_director_and_scope_managers(): void
    {
        Mail::fake();

        $firstVenue = $this->createVenue();
        $secondVenue = Venue::create([
            'name' => 'Dining Room',
            'wing' => 'Dining',
            'type' => 'dining',
            'capacity' => 30,
            'price_per_hour' => 1200,
            'description' => 'Dining venue',
            'is_active' => true,
        ]);

        $firstReservation = $this->createReservation($firstVenue, ['status' => 'reserved']);
        $secondReservation = $this->createReservation($secondVenue, ['status' => 'rejected']);

        ReservationTransaction::create([
            'reservation_id' => $firstReservation->id,
            'action' => 'status_changed',
            'from_status' => 'pending',
            'to_status' => 'reserved',
            'notes' => 'Reservation approved.',
        ]);
        ReservationTransaction::create([
            'reservation_id' => $secondReservation->id,
            'action' => 'status_changed',
            'from_status' => 'pending',
            'to_status' => 'rejected',
            'notes' => 'Reservation rejected.',
        ]);

        $directorHeaders = $this->adminHeaders('fb_director', 'assigned', [$firstVenue->id]);

        $this->getJson('/api/admin/reports/transactions', $directorHeaders)
            ->assertOk()
            ->assertJsonPath('summary.transactions', 2)
            ->assertJsonPath('summary.reservations', 2)
            ->assertJsonPath('summary.outlets', 2)
            ->assertJsonPath('summary.approvals', 1)
            ->assertJsonPath('summary.rejections', 1)
            ->assertJsonFragment([
                'reference_code' => $firstReservation->reference_code,
            ])
            ->assertJsonFragment([
                'reference_code' => $secondReservation->reference_code,
            ]);

        $managerHeaders = $this->adminHeaders('outlet_manager', 'assigned', [$firstVenue->id]);

        $this->getJson('/api/admin/reports/transactions', $managerHeaders)
            ->assertOk()
            ->assertJsonPath('summary.transactions', 1)
            ->assertJsonFragment([
                'reference_code' => $firstReservation->reference_code,
            ])
            ->assertJsonMissing([
                'reference_code' => $secondReservation->reference_code,
            ]);

        $supervisorHeaders = $this->adminHeaders('supervisor', 'assigned', [$firstVenue->id]);

        $this->getJson('/api/admin/reports/transactions', $supervisorHeaders)
            ->assertOk()
            ->assertJsonPath('summary.transactions', 1)
            ->assertJsonFragment([
                'reference_code' => $firstReservation->reference_code,
            ])
            ->assertJsonMissing([
                'reference_code' => $secondReservation->reference_code,
            ]);

        $pendingSupervisorReservation = $this->createReservation($firstVenue);

        $this->patchJson("/api/admin/reservations/{$pendingSupervisorReservation->id}/approve", [], $supervisorHeaders)
            ->assertOk();

        $this->patchJson("/api/admin/reservations/{$secondReservation->id}/approve", [], $supervisorHeaders)
            ->assertForbidden()
            ->assertJsonFragment([
                'message' => 'You are not authorized to access this outlet.',
            ]);

        $staffHeaders = $this->adminHeaders('staff');

        $this->getJson('/api/admin/reports/transactions', $staffHeaders)
            ->assertForbidden();
    }

    public function test_monthly_reports_cover_promotions_outlets_and_statuses(): void
    {
        $firstVenue = $this->createVenue();
        $secondVenue = Venue::create([
            'name' => 'Monthly Dining',
            'wing' => 'Dining',
            'type' => 'dining',
            'capacity' => 25,
            'price_per_hour' => 1200,
            'description' => 'Monthly dining venue',
            'is_active' => true,
        ]);

        $this->createReservation($firstVenue, [
            'status' => 'reserved',
            'event_date' => '2026-01-12 18:00:00',
        ]);
        $this->createReservation($secondVenue, [
            'status' => 'pending',
            'event_date' => '2026-02-10 18:00:00',
            'room' => 'Monthly Dining',
            'special_requests' => 'Promo package inquiry.',
        ]);
        $this->createReservation($secondVenue, [
            'status' => 'rejected',
            'event_date' => '2026-02-18 18:00:00',
            'room' => 'Monthly Dining',
        ]);

        $directorHeaders = $this->adminHeaders('fb_director', 'assigned', [$firstVenue->id]);

        $this->getJson('/api/admin/reports/monthly?year=2026', $directorHeaders)
            ->assertOk()
            ->assertJsonPath('summary.reservations', 3)
            ->assertJsonPath('summary.outlets', 2)
            ->assertJsonPath('summary.promotion_mentions', 1)
            ->assertJsonPath('summary.reserved', 1)
            ->assertJsonPath('summary.pending', 1)
            ->assertJsonPath('summary.rejected', 1)
            ->assertJsonPath('months.0.reservations', 1)
            ->assertJsonPath('months.1.reservations', 2)
            ->assertJsonPath('months.1.promotion_mentions', 1)
            ->assertJsonFragment([
                'outlet' => 'Monthly Dining',
                'reservations' => 2,
            ]);

        $managerHeaders = $this->adminHeaders('outlet_manager', 'assigned', [$firstVenue->id]);

        $this->getJson('/api/admin/reports/monthly?year=2026', $managerHeaders)
            ->assertOk()
            ->assertJsonPath('summary.reservations', 1)
            ->assertJsonPath('summary.outlets', 1)
            ->assertJsonPath('months.0.reservations', 1)
            ->assertJsonPath('months.1.reservations', 0);

        $staffHeaders = $this->adminHeaders('staff');

        $this->getJson('/api/admin/reports/monthly?year=2026', $staffHeaders)
            ->assertForbidden();
    }

    public function test_venue_availability_filters_events_by_date_range(): void
    {
        $firstVenue = $this->createVenue();
        $secondVenue = Venue::create([
            'name' => 'Range Hall',
            'wing' => 'Main Wing',
            'type' => 'function room',
            'capacity' => 80,
            'price_per_hour' => 1400,
            'description' => 'Range venue',
            'is_active' => true,
        ]);

        $this->createReservation($firstVenue, [
            'status' => 'reserved',
            'event_date' => '2026-05-15 18:00:00',
        ]);
        $this->createReservation($secondVenue, [
            'status' => 'pending',
            'event_date' => '2026-06-10 18:00:00',
        ]);

        $this->getJson('/api/venues/availability?start_date=2026-05-01&end_date=2026-05-31')
            ->assertOk()
            ->assertJsonPath('summary.available', 1)
            ->assertJsonPath('summary.with_events', 1)
            ->assertJsonFragment([
                'venue_id' => $firstVenue->id,
                'events_count' => 1,
                'is_available_for_range' => false,
            ])
            ->assertJsonFragment([
                'venue_id' => $secondVenue->id,
                'events_count' => 0,
                'is_available_for_range' => true,
            ]);
    }

    public function test_authorized_admin_can_adjust_reservation_details_with_history(): void
    {
        $venue = $this->createVenue();
        $reservation = $this->createReservation($venue);

        $headers = $this->adminHeaders('outlet_manager', 'assigned', [$venue->id]);

        $this->putJson("/api/admin/reservations/{$reservation->id}", [
            'name' => 'Updated Guest',
            'email' => 'updated@example.com',
            'phone' => '09998887777',
            'guests_count' => 6,
            'event_date' => '2026-06-15',
            'event_time' => '19:30',
            'room' => 'Updated Room',
            'table_number' => 'T9',
            'seat_number' => 'S9',
            'special_requests' => 'Near the entrance.',
            'type' => 'individual',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('reservation.name', 'Updated Guest')
            ->assertJsonPath('reservation.table_number', 'T9')
            ->assertJsonPath('reservation.seat_number', 'S9')
            ->assertJsonPath('reservation.guests_count', 6);

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'name' => 'Updated Guest',
            'table_number' => 'T9',
            'seat_number' => 'S9',
        ]);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservation->id,
            'action' => 'guest_details_updated',
            'notes' => 'Guest contact details updated by admin.',
        ]);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservation->id,
            'action' => 'table_seat_changed',
            'notes' => 'Table or seat assignments updated by admin.',
        ]);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservation->id,
            'action' => 'room_assigned',
            'notes' => 'Room/outlet assigned by admin.',
        ]);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservation->id,
            'action' => 'edited',
            'notes' => 'Reservation details edited by admin.',
        ]);
    }

    public function test_reservation_detail_adjustment_respects_permission_scope_and_conflicts(): void
    {
        $venue = $this->createVenue();
        $otherVenue = Venue::create([
            'name' => 'Other Hall',
            'wing' => 'Tower Wing',
            'type' => 'function room',
            'capacity' => 40,
            'price_per_hour' => 1000,
            'description' => 'Other venue',
            'is_active' => true,
        ]);

        $reservation = $this->createReservation($venue, [
            'event_date' => '2026-06-15 18:00:00',
            'event_time' => '18:00',
        ]);
        $conflictingReservation = $this->createReservation($venue, [
            'table_number' => 'T7',
            'seat_number' => 'S7',
            'event_date' => '2026-06-15 18:00:00',
            'event_time' => '18:00',
            'status' => 'pending',
        ]);

        $viewerHeaders = $this->adminHeaders('viewer');
        $this->putJson("/api/admin/reservations/{$reservation->id}", [
            'name' => 'Viewer Update',
        ], $viewerHeaders)
            ->assertForbidden();

        $scopedHeaders = $this->adminHeaders('outlet_manager', 'assigned', [$venue->id]);
        $this->putJson("/api/admin/reservations/{$reservation->id}", [
            'venue_id' => $otherVenue->id,
        ], $scopedHeaders)
            ->assertForbidden();

        $this->putJson("/api/admin/reservations/{$reservation->id}", [
            'table_number' => $conflictingReservation->table_number,
            'seat_number' => $conflictingReservation->seat_number,
            'event_date' => '2026-06-15',
            'event_time' => '18:00',
        ], $scopedHeaders)
            ->assertStatus(422)
            ->assertJsonPath('message', 'This seat or table is no longer available for the selected schedule. Please choose another option.');
    }

    public function test_seatmap_availability_is_scoped_by_selected_date_and_time(): void
    {
        $venue = $this->createVenue();

        Seat::create([
            'venue_id' => $venue->id,
            'table_number' => 'T1',
            'seat_number' => 'S1',
            'status' => 'available',
            'x_position' => 10,
            'y_position' => 20,
        ]);
        Seat::create([
            'venue_id' => $venue->id,
            'table_number' => 'T1',
            'seat_number' => 'S2',
            'status' => 'available',
            'x_position' => 30,
            'y_position' => 20,
        ]);

        $this->createReservation($venue, [
            'table_number' => 'T1',
            'seat_number' => 'S1',
            'event_date' => '2026-06-15',
            'event_time' => '18:00',
            'status' => 'pending',
            'type' => 'individual',
        ]);

        $path = '/api/seatmap/' . rawurlencode($venue->wing) . '/' . rawurlencode($venue->name);

        $this->getJson($path . '?event_date=2026-06-15&event_time=18:00')
            ->assertOk()
            ->assertJsonFragment([
                'id' => 'S1',
                'num' => 'S1',
                'status' => 'pending',
            ]);

        $this->getJson($path . '?event_date=2026-06-15&event_time=19:00')
            ->assertOk()
            ->assertJsonFragment([
                'id' => 'S1',
                'num' => 'S1',
                'status' => 'available',
            ]);
    }

    public function test_reservation_creation_rejects_same_seat_same_schedule_conflict(): void
    {
        $venue = $this->createVenue();

        $this->createReservation($venue, [
            'table_number' => 'T2',
            'seat_number' => 'S1',
            'event_date' => '2026-06-25',
            'event_time' => '18:00',
            'status' => 'pending',
            'type' => 'individual',
        ]);

        $payload = [
            'name' => 'Duplicate Guest',
            'email' => 'duplicate@example.com',
            'phone' => '09170000000',
            'venue_id' => $venue->id,
            'room' => $venue->name,
            'table_number' => 'T2',
            'seat_number' => 'S1',
            'guests_count' => 2,
            'event_date' => '2026-06-25',
            'event_time' => '18:00',
            'special_requests' => null,
            'type' => 'individual',
        ];

        $this->postJson('/api/reservations', $payload)
            ->assertStatus(422)
            ->assertJsonPath('message', 'This seat or table is no longer available for the selected schedule. Please choose another option.');

        $this->postJson('/api/reservations', array_merge($payload, [
            'event_time' => '19:00',
            'email' => 'allowed@example.com',
        ]))
            ->assertCreated();
    }

    public function test_function_room_reservation_stores_event_setup_details(): void
    {
        Mail::fake();

        $venue = $this->createVenue();

        $payload = [
            'name' => 'Setup Guest',
            'email' => 'setup@example.com',
            'phone' => '09175551234',
            'venue_id' => $venue->id,
            'room' => $venue->name,
            'table_number' => 'T5',
            'seat_number' => 'Seat 1, Seat 2',
            'guests_count' => 40,
            'event_date' => '2026-06-25',
            'event_time' => '18:00',
            'event_area' => 'Stage side',
            'setup_tables' => 8,
            'setup_chairs' => 40,
            'setup_requirements' => 'Projector, registration table, and stage lighting.',
            'special_requests' => 'Use promotion package.',
            'type' => 'whole',
        ];

        $this->postJson('/api/reservations', $payload)
            ->dump()
            ->assertCreated()
            ->assertJsonPath('event_area', 'Stage side')
            ->assertJsonPath('setup_tables', 8)
            ->assertJsonPath('setup_chairs', 40)
            ->assertJsonPath('setup_requirements', 'Projector, registration table, and stage lighting.');

        $this->assertDatabaseHas('reservations', [
            'email' => 'setup@example.com',
            'event_area' => 'Stage side',
            'setup_tables' => 8,
            'setup_chairs' => 40,
            'setup_requirements' => 'Projector, registration table, and stage lighting.',
        ]);
    }

    public function test_admin_can_cancel_reservation_with_audit_trail(): void
    {
        Mail::fake();

        $venue = $this->createVenue();
        $reservation = $this->createReservation($venue, [
            'status' => 'approved',
        ]);

        $headers = $this->adminHeaders();

        $this->patchJson("/api/admin/reservations/{$reservation->id}/cancel", [
            'reason' => 'Duplicate booking found',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('status', 'cancelled')
            ->assertJsonPath('cancellation_reason', 'Duplicate booking found');

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'cancelled',
            'cancellation_reason' => 'Duplicate booking found',
        ]);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservation->id,
            'action' => 'cancelled_by_admin',
            'from_status' => 'approved',
            'to_status' => 'cancelled',
            'notes' => 'Reservation cancelled by admin.',
        ]);

        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservation->id,
            'action' => 'notification_sent',
            'from_status' => 'cancelled',
            'to_status' => 'cancelled',
            'notes' => 'Cancellation email sent to guest.',
        ]);
    }

    public function test_super_admin_can_delete_reservation_and_triggers_soft_delete(): void
    {
        $venue = $this->createVenue();
        $reservation = $this->createReservation($venue);

        $headers = $this->adminHeaders('super_admin');

        $this->deleteJson("/api/admin/reservations/{$reservation->id}", [], $headers)
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Reservation deleted successfully');

        // Verify that the record is soft-deleted (deleted_at is set)
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
        ]);
        
        $freshReservation = Reservation::withTrashed()->find($reservation->id);
        $this->assertNotNull($freshReservation->deleted_at);

        // Verify that it is not returned by default query
        $this->assertNull(Reservation::find($reservation->id));

        // Verify that audit log (transaction) is created
        $this->assertDatabaseHas('reservation_transactions', [
            'reservation_id' => $reservation->id,
            'action' => 'deleted',
            'from_status' => $reservation->status,
            'to_status' => 'deleted',
        ]);
    }

    public function test_regular_admin_cannot_delete_reservation(): void
    {
        $venue = $this->createVenue();
        $reservation = $this->createReservation($venue);

        $headers = $this->adminHeaders('admin');

        $this->deleteJson("/api/admin/reservations/{$reservation->id}", [], $headers)
            ->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Only Super Admins are authorized to delete reservations.');

        // Verify that the record is NOT deleted
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'deleted_at' => null,
        ]);
    }
}
