<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\SeatMapController;
use App\Http\Controllers\VenueController;
use App\Http\Controllers\Admin\AdminReservationController;
use App\Http\Controllers\Admin\AdminAccountController;
use App\Http\Controllers\Admin\AdminReportController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\Client\ClientReservationController;
use App\Http\Middleware\AdminAccess;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Authentication routes
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/activate/{token}', [AuthController::class, 'showActivationDetails']);
    Route::post('/activate/{token}', [AuthController::class, 'activate']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/2fa/verify', [AuthController::class, 'verify2FA']);
});

// Admin authentication routes
Route::prefix('admin')->group(function () {
    Route::post('/login', [AuthController::class, 'adminLogin']);
});

Route::prefix('admin/accounts')->group(function () {
    Route::get('/', [AdminAccountController::class, 'index'])->middleware(AdminAccess::class . ':manage_accounts');
    Route::post('/', [AdminAccountController::class, 'store'])->middleware(AdminAccess::class . ':manage_accounts');
    Route::put('/me', [AdminAccountController::class, 'updateProfile'])->middleware(AdminAccess::class . ':view_admin');
    Route::get('/me/audit-logs', [AdminAccountController::class, 'myAuditLogs'])->middleware(AdminAccess::class . ':view_admin');
    Route::get('/me/sessions', [AdminAccountController::class, 'activeSessions'])->middleware(AdminAccess::class . ':view_admin');
    Route::delete('/me/sessions/{id}', [AdminAccountController::class, 'revokeSession'])->middleware(AdminAccess::class . ':view_admin');
    Route::post('/verify-password', [AdminAccountController::class, 'verifyPassword'])->middleware(AdminAccess::class . ':view_admin');
    Route::post('/request-email-change', [AdminAccountController::class, 'requestEmailChange'])->middleware(AdminAccess::class . ':view_admin');
    Route::post('/confirm-email-change', [AdminAccountController::class, 'confirmEmailChange'])->middleware(AdminAccess::class . ':view_admin');
    Route::post('/2fa/setup', [AdminAccountController::class, 'setup2FA'])->middleware(AdminAccess::class . ':view_admin');
    Route::post('/2fa/enable', [AdminAccountController::class, 'enable2FA'])->middleware(AdminAccess::class . ':view_admin');
    Route::post('/2fa/disable', [AdminAccountController::class, 'disable2FA'])->middleware(AdminAccess::class . ':view_admin');
    
    Route::put('/{admin}', [AdminAccountController::class, 'update'])->middleware(AdminAccess::class . ':manage_accounts');
    Route::patch('/{admin}/deactivate', [AdminAccountController::class, 'deactivate'])->middleware(AdminAccess::class . ':manage_accounts');
    Route::patch('/{admin}/reactivate', [AdminAccountController::class, 'reactivate'])->middleware(AdminAccess::class . ':manage_accounts');
});

Route::prefix('admin/roles')->group(function () {
    Route::get('/', [\App\Http\Controllers\Admin\RoleController::class, 'index'])->middleware(AdminAccess::class . ':manage_accounts');
    Route::get('/permissions', [\App\Http\Controllers\Admin\RoleController::class, 'permissions'])->middleware(AdminAccess::class . ':manage_accounts');
    Route::post('/', [\App\Http\Controllers\Admin\RoleController::class, 'store'])->middleware(AdminAccess::class . ':manage_accounts');
    Route::put('/{id}', [\App\Http\Controllers\Admin\RoleController::class, 'update'])->middleware(AdminAccess::class . ':manage_accounts');
    Route::delete('/{id}', [\App\Http\Controllers\Admin\RoleController::class, 'destroy'])->middleware(AdminAccess::class . ':manage_accounts');
});

Route::prefix('admin/reports')->group(function () {
    Route::get('/outlets', [AdminReportController::class, 'outletReports'])->middleware(AdminAccess::class . ':view_outlet_reports');
    Route::get('/transactions', [AdminReportController::class, 'transactionReports'])->middleware(AdminAccess::class . ':view_transactions');
    Route::get('/monthly', [AdminReportController::class, 'monthlyReports'])->middleware(AdminAccess::class . ':view_outlet_reports');
});

Route::prefix('admin/notifications')->group(function () {
    Route::get('/acknowledgments', [AdminReservationController::class, 'acknowledgments'])->middleware(AdminAccess::class . ':view_admin');
    Route::post('/acknowledgments', [AdminReservationController::class, 'acknowledgeNotification'])->middleware(AdminAccess::class . ':acknowledge_notifications');
});

// Admin Event routes
Route::prefix('admin/events')->group(function () {
    Route::get('/', [EventController::class, 'index'])->middleware(AdminAccess::class . ':manage_events');
    Route::post('/', [EventController::class, 'store'])->middleware(AdminAccess::class . ':manage_events');
    Route::put('/{event}', [EventController::class, 'update'])->middleware(AdminAccess::class . ':manage_events');
    Route::post('/{event}/image', [EventController::class, 'uploadImage'])->middleware(AdminAccess::class . ':manage_events');
    Route::delete('/{event}', [EventController::class, 'destroy'])->middleware(AdminAccess::class . ':manage_events');
});

// Public Event routes
Route::prefix('events')->group(function () {
    Route::get('/', [EventController::class, 'index']);
    Route::get('/{slug}', [EventController::class, 'show']);
});

// Venue routes
Route::prefix('venues')->group(function () {
    Route::get('/', [VenueController::class, 'index']);
    Route::get('/availability', [VenueController::class, 'availability']);
    Route::get('/time-slots', [VenueController::class, 'timeSlots']);
    Route::get('/{id}', [VenueController::class, 'show']);
    Route::get('/{id}/available-subrooms', [VenueController::class, 'availableSubrooms']);
    Route::post('/', [VenueController::class, 'store'])->middleware(AdminAccess::class . ':manage_venues');
    Route::put('/{id}', [VenueController::class, 'update'])->middleware(AdminAccess::class . ':manage_venues');
    Route::post('/{id}/image', [VenueController::class, 'uploadImage'])->middleware(AdminAccess::class . ':manage_venues');
    Route::delete('/{id}', [VenueController::class, 'destroy'])->middleware(AdminAccess::class . ':manage_venues');
    
    // Additional venue endpoints
    Route::get('/wing/{wing}', [VenueController::class, 'getByWing']);
    Route::get('/type/{type}', [VenueController::class, 'getByType']);
    Route::get('/search/{term}', [VenueController::class, 'search']);
});

// Seatmap routes
Route::prefix('seatmap')->group(function () {
    // Admin routes (Drafts and Publishing)
    Route::prefix('admin')->middleware(AdminAccess::class . ':manage_seat_maps')->group(function () {
        Route::get('/id/{venueId}', [SeatMapController::class, 'getAdminSeatmapById']);
        Route::post('/id/{venueId}/draft', [SeatMapController::class, 'saveSeatmapById']);
        Route::post('/id/{venueId}/publish', [SeatMapController::class, 'publishSeatmapById'])->middleware(AdminAccess::class . ':publish_seat_maps');
    });

    // Live Guest routes (Published only)
    Route::get('/id/{venueId}', [SeatMapController::class, 'getSeatmapById']);

    // Legacy fallback routes for wing/room (Admin saves as draft, guest reads as live)
    Route::get('/{wing}/{room}', [SeatMapController::class, 'getSeatmap'])
        ->where('room', '.*');
    Route::post('/{wing}/{room}', [SeatMapController::class, 'saveSeatmap'])
        ->where('room', '.*')->middleware(AdminAccess::class . ':manage_seat_maps');
});

// Room seats routes (alias for seatmap to match frontend expectations)
Route::get('/rooms/{wing}/{room}/seats', [SeatMapController::class, 'getSeatmap'])
    ->where('wing', '.*')
    ->where('room', '.*');

// Alternative route using venue ID to avoid forward slash issues
Route::get('/rooms/{venueId}/seats', [SeatMapController::class, 'getSeatmapById']);

// Admin reservation routes
Route::prefix('admin/reservations')->group(function () {
    Route::get('/', [AdminReservationController::class, 'index'])->middleware(AdminAccess::class . ':view_admin');
    Route::get('/stats', [AdminReservationController::class, 'getStats'])->middleware(AdminAccess::class . ':view_admin');
    Route::post('/', [AdminReservationController::class, 'store'])->middleware(AdminAccess::class . ':manage_reservations');
    Route::get('/{reservation}', [AdminReservationController::class, 'show'])->middleware(AdminAccess::class . ':view_admin');
    Route::put('/{reservation}', [AdminReservationController::class, 'update'])->middleware(AdminAccess::class . ':adjust_reservation_details');
    Route::patch('/{reservation}/pricing', [AdminReservationController::class, 'updatePricing'])->middleware(AdminAccess::class . ':manage_reservations');
    Route::patch('/{reservation}/coordination', [AdminReservationController::class, 'updateCoordination'])->middleware(AdminAccess::class . ':adjust_reservation_details');
    Route::post('/{reservation}/seen', [AdminReservationController::class, 'markSeen'])->middleware(AdminAccess::class . ':view_admin');
    Route::patch('/{id}/approve', [AdminReservationController::class, 'approve'])->middleware(AdminAccess::class . ':manage_reservations');
    Route::patch('/{id}/reject', [AdminReservationController::class, 'reject'])->middleware(AdminAccess::class . ':manage_reservations');
    Route::patch('/{id}/revert', [AdminReservationController::class, 'revert'])->middleware(AdminAccess::class . ':manage_reservations');
    Route::patch('/{id}/cancel', [AdminReservationController::class, 'cancel'])->middleware(AdminAccess::class . ':manage_reservations');
    Route::delete('/{id}', [AdminReservationController::class, 'destroy'])->middleware(AdminAccess::class . ':delete_reservations');
});

// Client reservation routes
Route::prefix('reservations')->group(function () {
    Route::post('/recover-code', [ClientReservationController::class, 'recoverReferenceCode']);
    Route::get('/', [ClientReservationController::class, 'index']);
    Route::post('/', [ClientReservationController::class, 'store']);
    Route::get('/{id}', [ClientReservationController::class, 'show']);
    Route::put('/{id}', [ClientReservationController::class, 'update']);
    Route::patch('/{id}/reject', [ClientReservationController::class, 'reject']);
    Route::delete('/{id}', [ClientReservationController::class, 'destroy']);
    Route::post('/{reservation}/notify', [ClientReservationController::class, 'notify'])->middleware(AdminAccess::class . ':manage_reservations');
});


// Client Display Settings routes
Route::prefix('client-display')->group(function () {
    Route::get('/', [\App\Http\Controllers\ClientDisplaySettingController::class, 'index']);
    Route::put('/{section}', [\App\Http\Controllers\ClientDisplaySettingController::class, 'updateSection'])->middleware(\App\Http\Middleware\AdminAccess::class . ':manage_venues');
});
