<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AdminPermissionOverride extends Model
{
    use HasFactory;

    protected $fillable = [
        'admin_id',
        'permission_id',
        'effect',
        'granted_by_admin_id',
        'reason',
    ];

    public function admin()
    {
        return $this->belongsTo(Admin::class);
    }

    public function permission()
    {
        return $this->belongsTo(Permission::class);
    }

    public function grantedBy()
    {
        return $this->belongsTo(Admin::class, 'granted_by_admin_id');
    }
}
