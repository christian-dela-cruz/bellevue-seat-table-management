<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Middleware\AdminAccess;
use App\Models\Admin;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class AdminAccountController extends Controller
{
    private const ROLES = [
        'super_admin',
        'admin',
        'fb_director',
        'outlet_manager',
        'supervisor',
        'staff',
    ];

    public function __construct(private AuthService $authService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $actor = $this->currentAdmin($request);

        return response()->json([
            'data' => Admin::query()
                ->when(
                    ($actor['role'] ?? '') !== 'super_admin',
                    fn ($query) => $query->where('role', '!=', 'super_admin')
                )
                ->orderBy('role')
                ->orderBy('name')
                ->get()
                ->map(fn (Admin $admin) => $this->formatAdmin($admin))
                ->values(),
            'roles' => self::ROLES,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $this->currentAdmin($request);
        $allowedRoles = $this->assignableRoles($actor);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:admins,email'],
            'username' => ['required', 'string', 'max:255', 'unique:admins,username'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in($allowedRoles)],
            'scope_type' => ['required', Rule::in(['all', 'assigned'])],
            'outlet_scope' => ['nullable', 'array'],
            'outlet_scope.*' => ['nullable'],
            'overrides' => ['nullable', 'array'],
            'overrides.*.permission_id' => ['required', 'exists:permissions,id'],
            'overrides.*.effect' => ['required', Rule::in(['allow', 'deny'])],
        ]);
        $scopeType = $this->scopeTypeForRole($validated['role'], $validated['scope_type']);

        if ($scopeType === 'assigned' && empty(array_filter($validated['outlet_scope'] ?? []))) {
            return response()->json([
                'success' => false,
                'message' => 'Assigned-scope accounts require at least one outlet.',
            ], 422);
        }

        $admin = Admin::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'username' => $validated['username'],
            'password' => $validated['password'],
            'role' => AdminAccess::normalizeRole($validated['role']),
            'scope_type' => $scopeType,
            'outlet_scope' => $scopeType === 'assigned'
                ? array_values($validated['outlet_scope'] ?? [])
                : [],
        ]);

        if (!empty($validated['overrides'])) {
            foreach ($validated['overrides'] as $override) {
                $admin->permissionOverrides()->create([
                    'permission_id' => $override['permission_id'],
                    'effect' => $override['effect'],
                    'granted_by_admin_id' => $actor['id'] ?? null,
                ]);
            }
        }

        \App\Models\AuditLog::create([
            'action' => 'created',
            'model_type' => Admin::class,
            'model_id' => $admin->id,
            'admin_id' => $actor['id'] ?? null,
            'new_values' => $admin->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Admin account created successfully.',
            'data' => $this->formatAdmin($admin),
        ], 201);
    }

    public function update(Request $request, Admin $admin): JsonResponse
    {
        $actor = $this->currentAdmin($request);
        $allowedRoles = $this->assignableRoles($actor);

        if (!$this->canModifyTarget($actor, $admin)) {
            return response()->json([
                'success' => false,
                'message' => 'You are not authorized to modify this account.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('admins', 'email')->ignore($admin->id)],
            'username' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('admins', 'username')->ignore($admin->id)],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['sometimes', 'required', Rule::in($allowedRoles)],
            'scope_type' => ['sometimes', 'required', Rule::in(['all', 'assigned'])],
            'outlet_scope' => ['nullable', 'array'],
            'outlet_scope.*' => ['nullable'],
            'overrides' => ['nullable', 'array'],
            'overrides.*.permission_id' => ['required', 'exists:permissions,id'],
            'overrides.*.effect' => ['required', Rule::in(['allow', 'deny'])],
        ]);

        $updates = collect($validated)->only(['name', 'email', 'username', 'scope_type'])->toArray();
        $targetRole = $validated['role'] ?? $admin->role;
        $targetScopeType = $this->scopeTypeForRole($targetRole, $validated['scope_type'] ?? $admin->scope_type ?? 'all');
        $targetOutletScope = $validated['outlet_scope'] ?? $admin->outlet_scope ?? [];

        if ($targetScopeType === 'assigned' && empty(array_filter($targetOutletScope))) {
            return response()->json([
                'success' => false,
                'message' => 'Assigned-scope accounts require at least one outlet.',
            ], 422);
        }

        if (array_key_exists('role', $validated)) {
            $updates['role'] = AdminAccess::normalizeRole($validated['role']);
        }

        if (!empty($validated['password'])) {
            $updates['password'] = $validated['password'];
        }

        if (array_key_exists('outlet_scope', $validated) || array_key_exists('scope_type', $validated) || array_key_exists('role', $validated)) {
            $targetRole = $updates['role'] ?? $admin->role;
            $scopeType = $this->scopeTypeForRole($targetRole, $updates['scope_type'] ?? $admin->scope_type ?? 'all');
            $updates['scope_type'] = $scopeType;
            $updates['outlet_scope'] = $scopeType === 'assigned'
                ? array_values($validated['outlet_scope'] ?? $admin->outlet_scope ?? [])
                : [];
        }

        $oldValues = $admin->toArray();
        $admin->update($updates);

        if (array_key_exists('overrides', $validated)) {
            $admin->permissionOverrides()->delete();
            if (!empty($validated['overrides'])) {
                foreach ($validated['overrides'] as $override) {
                    $admin->permissionOverrides()->create([
                        'permission_id' => $override['permission_id'],
                        'effect' => $override['effect'],
                        'granted_by_admin_id' => $actor['id'] ?? null,
                    ]);
                }
            }
        }

        AdminAccess::invalidateAdminCache($admin);

        \App\Models\AuditLog::create([
            'action' => 'updated',
            'model_type' => Admin::class,
            'model_id' => $admin->id,
            'admin_id' => $actor['id'] ?? null,
            'old_values' => $oldValues,
            'new_values' => $admin->fresh()->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Admin account updated successfully.',
            'data' => $this->formatAdmin($admin->fresh()),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $actor = $this->currentAdmin($request);
        $admin = Admin::findOrFail($actor['id']);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('admins', 'email')->ignore($admin->id)],
            'username' => ['required', 'string', 'max:255', Rule::unique('admins', 'username')->ignore($admin->id)],
            'current_password' => ['nullable', 'string'],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        $updates = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'username' => $validated['username'],
        ];

        if (!empty($validated['password'])) {
            if (empty($validated['current_password']) || !Hash::check($validated['current_password'], $admin->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Current password is incorrect.',
                ], 422);
            }

            $updates['password'] = $validated['password'];
        }

        $admin->update($updates);
        $payload = $this->authService->adminPayload($admin->fresh());

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'admin' => $payload,
        ]);
    }

    private function assignableRoles(?array $actor): array
    {
        return match ($actor['role'] ?? '') {
            'super_admin' => self::ROLES,
            'admin' => ['fb_director', 'outlet_manager', 'supervisor', 'staff'],
            default => [],
        };
    }

    private function canModifyTarget(?array $actor, Admin $target): bool
    {
        $actorRole = $actor['role'] ?? '';
        $targetRole = AdminAccess::normalizeRole($target->role);

        if ($target->id === ($actor['id'] ?? null)) {
            return false;
        }

        if ($actorRole === 'super_admin') {
            return $targetRole !== 'super_admin';
        }

        if ($actorRole === 'admin') {
            return !in_array($targetRole, ['super_admin', 'admin'], true);
        }

        return false;
    }

    private function scopeTypeForRole(string $role, string $requestedScope): string
    {
        return in_array(AdminAccess::normalizeRole($role), ['outlet_manager', 'supervisor', 'staff'], true)
            ? 'assigned'
            : $requestedScope;
    }

    public function deactivate(Request $request, Admin $admin): JsonResponse
    {
        $actor = $this->currentAdmin($request);

        if (!$this->canModifyTarget($actor, $admin)) {
            return response()->json([
                'success' => false,
                'message' => 'You are not authorized to deactivate this account.',
            ], 403);
        }

        $admin->update(['is_active' => false]);

        return response()->json([
            'success' => true,
            'message' => 'Account deactivated successfully.',
            'data' => $this->formatAdmin($admin->fresh()),
        ]);
    }

    public function reactivate(Request $request, Admin $admin): JsonResponse
    {
        $actor = $this->currentAdmin($request);

        if (!$this->canModifyTarget($actor, $admin)) {
            return response()->json([
                'success' => false,
                'message' => 'You are not authorized to reactivate this account.',
            ], 403);
        }

        $admin->update(['is_active' => true]);

        return response()->json([
            'success' => true,
            'message' => 'Account reactivated successfully.',
            'data' => $this->formatAdmin($admin->fresh()),
        ]);
    }

    private function formatAdmin(Admin $admin): array
    {
        $role = AdminAccess::normalizeRole($admin->role);
        $admin->load('permissionOverrides.permission');

        return [
            'id' => $admin->id,
            'name' => $admin->name,
            'email' => $admin->email,
            'username' => $admin->username,
            'role' => $role,
            'permissions' => AdminAccess::permissionsForAdmin($admin),
            'overrides' => $admin->permissionOverrides->map(function ($override) {
                return [
                    'permission_id' => $override->permission_id,
                    'permission_slug' => $override->permission ? $override->permission->slug : null,
                    'effect' => $override->effect,
                ];
            })->values(),
            'scope_type' => $admin->scope_type ?: 'all',
            'outlet_scope' => $admin->scope_type === 'assigned' ? ($admin->outlet_scope ?: []) : [],
            'is_active' => (bool) $admin->is_active,
            'created_at' => optional($admin->created_at)->toISOString(),
            'updated_at' => optional($admin->updated_at)->toISOString(),
        ];
    }

    private function currentAdmin(Request $request): ?array
    {
        return $request->attributes->get('admin');
    }
}
