<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientDisplaySetting extends Model
{
    protected $fillable = [
        'section',
        'desktop_columns',
        'tablet_columns',
        'mobile_columns',
        'visible_rows',
        'card_size',
        'ordered_ids',
        'hidden_ids',
    ];

    protected $casts = [
        'desktop_columns' => 'integer',
        'tablet_columns' => 'integer',
        'mobile_columns' => 'integer',
        'visible_rows' => 'integer',
        'ordered_ids' => 'array',
        'hidden_ids' => 'array',
    ];
}
