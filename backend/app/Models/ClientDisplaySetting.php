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
        'layout_engine',
        'card_width',
        'stretch_to_fill',
        'flex_alignment',
    ];

    protected $casts = [
        'desktop_columns' => 'integer',
        'tablet_columns' => 'integer',
        'mobile_columns' => 'integer',
        'visible_rows' => 'integer',
        'ordered_ids' => 'array',
        'hidden_ids' => 'array',
        'card_width' => 'integer',
        'stretch_to_fill' => 'boolean',
    ];
}
