<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reservation extends Model
{
    protected $fillable = [
        'reference_code',
        'name',
        'email',
        'phone',
        'venue_id',
        'room',
        'table_number',
        'seat_number',
        'seat_id',
        'guests_count',
        'event_date',
        'event_time',
        'special_requests',
        'status',
        'type',
        'is_standalone',
        'submitted_at',
        'rejection_reason',
        'cancellation_reason',
        'cancelled_at',
    ];

    protected $casts = [
        'event_date'   => 'date:Y-m-d',   // ← fixed: was 'datetime', now serialises as YYYY-MM-DD
        'submitted_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'is_standalone' => 'boolean',
    ];

    public function venue(): BelongsTo
    {
        return $this->belongsTo(Venue::class);
    }
}
