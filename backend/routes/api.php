<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\SeatMapController;
use App\Http\Controllers\VenueController;
use App\Http\Controllers\Admin\AdminReservationController;
use App\Http\Controllers\Client\ClientReservationController;

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
});

// Admin authentication routes
Route::prefix('admin')->group(function () {
    Route::post('/login', [AuthController::class, 'adminLogin']);
});

// Venue routes
Route::prefix('venues')->group(function () {
    Route::get('/', [VenueController::class, 'index']);
    Route::get('/{id}', [VenueController::class, 'show']);
    Route::post('/', [VenueController::class, 'store']);
    Route::put('/{id}', [VenueController::class, 'update']);
    Route::delete('/{id}', [VenueController::class, 'destroy']);
    
    // Additional venue endpoints
    Route::get('/wing/{wing}', [VenueController::class, 'getByWing']);
    Route::get('/type/{type}', [VenueController::class, 'getByType']);
    Route::get('/search/{term}', [VenueController::class, 'search']);
});

// Seatmap routes
Route::prefix('seatmap')->group(function () {
    Route::get('/{wing}/{room}', [SeatMapController::class, 'getSeatmap']);
});

// Room seats routes (alias for seatmap to match frontend expectations)
Route::get('/rooms/{wing}/{room}/seats', [SeatMapController::class, 'getSeatmap'])
    ->where('wing', '.*')
    ->where('room', '.*');

// Alternative route using venue ID to avoid forward slash issues
Route::get('/rooms/{venueId}/seats', [SeatMapController::class, 'getSeatmapById']);

// Admin reservation routes
Route::prefix('admin/reservations')->group(function () {
    Route::get('/', [AdminReservationController::class, 'index']);
    Route::get('/stats', [AdminReservationController::class, 'getStats']);
    Route::post('/', [AdminReservationController::class, 'store']);
    Route::get('/{id}', [AdminReservationController::class, 'show']);
    Route::put('/{id}', [AdminReservationController::class, 'update']);
    Route::patch('/{id}/approve', [AdminReservationController::class, 'approve']);
    Route::patch('/{id}/reject', [AdminReservationController::class, 'reject']);
    Route::patch('/{id}/revert', [AdminReservationController::class, 'revert']);
    Route::delete('/{id}', [AdminReservationController::class, 'destroy']);
});

// Client reservation routes
Route::prefix('reservations')->group(function () {
    Route::get('/', [ClientReservationController::class, 'index']);
    Route::post('/', [ClientReservationController::class, 'store']);
    Route::get('/{id}', [ClientReservationController::class, 'show']);
    Route::put('/{id}', [ClientReservationController::class, 'update']);
    Route::patch('/{id}/reject', [ClientReservationController::class, 'reject']);
    Route::delete('/{id}', [ClientReservationController::class, 'destroy']);
    Route::post('/{reservation}/notify', [ClientReservationController::class, 'notify']);
});
