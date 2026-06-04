<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Admin extends Model
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'username',
        'password',
        'role',
        'scope_type',
        'outlet_scope',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'role' => 'string',
        'scope_type' => 'string',
        'outlet_scope' => 'array',
        'is_active' => 'boolean',
    ];

    public function dbRole()
    {
        return $this->belongsTo(Role::class, 'role', 'slug');
    }

    public function permissionOverrides()
    {
        return $this->hasMany(AdminPermissionOverride::class);
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }
}
