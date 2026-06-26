<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'action',
        'model_type',
        'model_id',
        'admin_id',
        'old_values',
        'new_values',
        'ip_address',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            try {
                if (empty($model->ip_address) && app()->has('request') && request()) {
                    $model->ip_address = request()->ip();
                }
            } catch (\Throwable $e) {
                // Safe fallback for console/testing environments where request is not available
            }
        });
    }

    public function admin()
    {
        return $this->belongsTo(Admin::class);
    }
}
