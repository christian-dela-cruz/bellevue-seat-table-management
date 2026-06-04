<?php

namespace App\Services;

use App\Models\Admin;
use App\Http\Middleware\AdminAccess;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthService
{
    /**
     * Authenticate admin user
     */
    public function login(string $username, string $password): ?array
    {
        // Check for hardcoded superadmin credentials first
        if ($username === 'super@admin.com' && $password === 'superadmin123') {
            $token = 'admin-token-' . Str::random(64);
            $admin = [
                'id' => 0,
                'name' => 'Super Administrator',
                'username' => 'super@admin.com',
                'email' => 'super@admin.com',
                'role' => 'super_admin',
                'permissions' => AdminAccess::permissionsForRole('super_admin'),
                'scope_type' => 'all',
                'outlet_scope' => [],
            ];
            Cache::put('admin_token:' . hash('sha256', $token), $admin, now()->addHours(8));

            return [
                'success' => true,
                'message' => 'Login successful',
                'token' => $token,
                'admin' => $admin,
            ];
        }

        $admin = Admin::where('username', $username)->first();

        if (!$admin) {
            \Log::error('Admin not found: ' . $username);
            return null;
        }

        if (!$admin->is_active) {
            \Log::warning('Inactive admin login attempt: ' . $username);
            return null;
        }

        if (!Hash::check($password, $admin->password)) {
            \Log::error('Password mismatch for admin: ' . $username);
            return null;
        }

        $token = 'admin-token-' . Str::random(64);
        $adminPayload = $this->adminPayload($admin);

        Cache::put('admin_token:' . hash('sha256', $token), $adminPayload, now()->addHours(8));

        return [
            'success' => true,
            'message' => 'Login successful',
            'token' => $token,
            'admin' => $adminPayload,
        ];
    }

    /**
     * Logout user (clear token)
     */
    public function logout(?string $token = null): array
    {
        if ($token) {
            Cache::forget('admin_token:' . hash('sha256', $token));
        }

        return [
            'success' => true,
            'message' => 'Logout successful'
        ];
    }

    /**
     * Get current authenticated user
     */
    public function getCurrentUser(?string $token = null): array
    {
        if ($token) {
            $admin = Cache::get('admin_token:' . hash('sha256', $token));

            if ($admin) {
                return [
                    'success' => true,
                    'admin' => $admin,
                ];
            }
        }

        return [
            'success' => false,
            'message' => 'Invalid or expired admin session.',
        ];
    }

    /**
     * Validate admin credentials
     */
    public function validateCredentials(string $username, string $password): bool
    {
        $admin = Admin::where('username', $username)->first();
        
        if (!$admin) {
            return false;
        }
        
        return Hash::check($password, $admin->password);
    }

    public function adminPayload(Admin $admin): array
    {
        $role = AdminAccess::normalizeRole($admin->role);
        $scopeType = $admin->scope_type ?: 'all';

        return [
            'id' => $admin->id,
            'name' => $admin->name,
            'username' => $admin->username,
            'email' => $admin->email,
            'role' => $role,
            'permissions' => AdminAccess::permissionsForRole($role),
            'scope_type' => $scopeType,
            'outlet_scope' => $scopeType === 'assigned' ? ($admin->outlet_scope ?: []) : [],
            'is_active' => (bool) $admin->is_active,
        ];
    }
}
