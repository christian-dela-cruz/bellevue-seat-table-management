<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SeatMap extends Model
{
    protected $fillable = [
        'venue_id',
        'status',
        'payload',
        'version_number',
        'created_by',
        'published_by',
        'published_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'published_at' => 'datetime',
    ];

    public function venue(): BelongsTo
    {
        return $this->belongsTo(Venue::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'created_by');
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'published_by');
    }
}
