<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    protected $fillable = [
        'venue_id',
        'slug',
        'title',
        'description',
        'banner_image',
        'start_datetime',
        'end_datetime',
        'status',
        'metadata',
    ];

    protected $casts = [
        'start_datetime' => 'datetime',
        'end_datetime' => 'datetime',
        'metadata' => 'array',
    ];

    public function venue()
    {
        return $this->belongsTo(Venue::class);
    }

    public function reservations()
    {
        return $this->hasMany(Reservation::class);
    }
}
