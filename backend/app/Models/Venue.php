<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Venue extends Model
{
    protected $fillable = [
        'parent_id',
        'name',
        'slug',
        'display_name',
        'wing',
        'type',
        'category',
        'capacity',
        'price_per_hour',
        'description',
        'image',
        'display_order',
        'is_active',
        'is_visible',
        'show_on_landing',
        'reservations_enabled',
        'parent_selectable',
        'child_selectable',
        'reservation_route',
        'image_position',
        'metadata',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_visible' => 'boolean',
        'show_on_landing' => 'boolean',
        'reservations_enabled' => 'boolean',
        'parent_selectable' => 'boolean',
        'child_selectable' => 'boolean',
        'price_per_hour' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Venue::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Venue::class, 'parent_id')->orderBy('display_order')->orderBy('name');
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    public function seats(): HasMany
    {
        return $this->hasMany(Seat::class);
    }
}
