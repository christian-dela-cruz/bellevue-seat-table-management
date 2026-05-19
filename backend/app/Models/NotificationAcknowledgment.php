<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationAcknowledgment extends Model
{
    protected $fillable = [
        'reservation_id',
        'notification_key',
        'acknowledged_by_id',
        'acknowledged_by_name',
        'acknowledged_by_role',
        'outlet',
        'event_date',
        'event_time',
        'acknowledged_at',
        'metadata',
    ];

    protected $casts = [
        'event_date' => 'date:Y-m-d',
        'acknowledged_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }
}
