<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class AdminAccess
{
    public const ROLE_PERMISSIONS = [
        'super_admin' => [
            'view_admin',
            'manage_reservations',
            'adjust_reservation_details',
            'delete_reservations',
            'acknowledge_notifications',
            'manage_seat_maps',
            'manage_venues',
            'view_outlet_reports',
            'view_global_reports',
            'view_transactions',
            'manage_accounts',
            'manage_users',
        ],
        'admin' => [
            'view_admin',
            'manage_reservations',
            'adjust_reservation_details',
            'delete_reservations',
            'acknowledge_notifications',
            'manage_seat_maps',
            'manage_venues',
            'view_outlet_reports',
            'view_transactions',
            'manage_accounts',
        ],
        'fb_director' => [
            'view_admin',
            'view_outlet_reports',
            'view_global_reports',
            'view_transactions',
        ],
        'outlet_manager' => [
            'view_admin',
            'manage_reservations',
            'adjust_reservation_details',
            'acknowledge_notifications',
            'view_outlet_reports',
            'view_transactions',
        ],
        'supervisor' => [
            'view_admin',
            'manage_reservations',
            'adjust_reservation_details',
            'acknowledge_notifications',
            'view_outlet_reports',
            'view_transactions',
        ],
        'staff' => [
            'view_admin',
            'acknowledge_notifications',
        ],
        'viewer' => ['view_admin'],
    ];

    public const LEGACY_ROLES = [
        'manager' => 'outlet_manager',
        'view_only' => 'viewer',
    ];

    public static function normalizeRole(?string $role): string
    {
        $role = strtolower((string) $role);

        return self::LEGACY_ROLES[$role] ?? $role;
    }

    public static function permissionsForRole(?string $role): array
    {
        $roleSlug = self::normalizeRole($role);

        return Cache::remember("role_{$roleSlug}_permissions", now()->addHours(24), function () use ($roleSlug) {
            $dbRole = \App\Models\Role::with('permissions')->where('slug', $roleSlug)->first();
            
            if ($dbRole) {
                return $dbRole->permissions->pluck('slug')->toArray();
            }

            return self::ROLE_PERMISSIONS[$roleSlug] ?? [];
        });
    }

    public static function permissionsForAdmin(?\App\Models\Admin $admin): array
    {
        if (!$admin) {
            return [];
        }

        $roleSlug = self::normalizeRole($admin->role);

        if ($roleSlug === 'super_admin' || $admin->id === 0) {
            return self::permissionsForRole('super_admin');
        }

        return Cache::remember("admin_{$admin->id}_effective_permissions", now()->addHours(24), function () use ($admin, $roleSlug) {
            $rolePermissions = self::permissionsForRole($roleSlug);

            $overrides = \App\Models\AdminPermissionOverride::with('permission')
                ->where('admin_id', $admin->id)
                ->get();

            $allowOverrides = [];
            $denyOverrides = [];

            foreach ($overrides as $override) {
                if ($override->permission) {
                    if ($override->effect === 'allow') {
                        $allowOverrides[] = $override->permission->slug;
                    } else {
                        $denyOverrides[] = $override->permission->slug;
                    }
                }
            }

            // Effective = (Role + Allow) - Deny
            $effective = array_unique(array_merge($rolePermissions, $allowOverrides));
            $effective = array_diff($effective, $denyOverrides);

            return array_values($effective);
        });
    }

    public static function invalidateAdminCache(\App\Models\Admin $admin): void
    {
        Cache::forget("admin_{$admin->id}_effective_permissions");
    }

    public function handle(Request $request, Closure $next, string $permission = 'view_admin'): Response
    {
        $token = $request->bearerToken() ?: $request->header('X-Admin-Token');

        if (!$token) {
            return response()->json([
                'success' => false,
                'message' => 'Admin authentication is required.',
            ], 401);
        }

        $admin = Cache::get('admin_token:' . hash('sha256', $token));

        if (!$admin) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired admin session.',
            ], 401);
        }

        $permissions = $admin['permissions'] ?? [];

        if (!in_array($permission, $permissions, true)) {
            return response()->json([
                'success' => false,
                'message' => 'You are not authorized to perform this action.',
            ], 403);
        }

        $request->attributes->set('admin', $admin);

        return $next($request);
    }
}
