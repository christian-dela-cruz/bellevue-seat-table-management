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
        'staff',
        'viewer',
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
        ]);

        $admin = Admin::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'username' => $validated['username'],
            'password' => $validated['password'],
            'role' => AdminAccess::normalizeRole($validated['role']),
            'scope_type' => $validated['scope_type'],
            'outlet_scope' => $validated['scope_type'] === 'assigned'
                ? array_values($validated['outlet_scope'] ?? [])
                : [],
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
        ]);

        $updates = collect($validated)->only(['name', 'email', 'username', 'scope_type'])->toArray();

        if (array_key_exists('role', $validated)) {
            $updates['role'] = AdminAccess::normalizeRole($validated['role']);
        }

        if (!empty($validated['password'])) {
            $updates['password'] = $validated['password'];
        }

        if (array_key_exists('outlet_scope', $validated) || array_key_exists('scope_type', $validated)) {
            $scopeType = $updates['scope_type'] ?? $admin->scope_type ?? 'all';
            $updates['outlet_scope'] = $scopeType === 'assigned'
                ? array_values($validated['outlet_scope'] ?? $admin->outlet_scope ?? [])
                : [];
        }

        $admin->update($updates);

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
        return ($actor['role'] ?? '') === 'super_admin'
            ? self::ROLES
            : array_values(array_filter(self::ROLES, fn ($role) => $role !== 'super_admin'));
    }

    private function canModifyTarget(?array $actor, Admin $target): bool
    {
        if (($actor['role'] ?? '') === 'super_admin') {
            return true;
        }

        return $target->role !== 'super_admin';
    }

    private function formatAdmin(Admin $admin): array
    {
        $role = AdminAccess::normalizeRole($admin->role);

        return [
            'id' => $admin->id,
            'name' => $admin->name,
            'email' => $admin->email,
            'username' => $admin->username,
            'role' => $role,
            'permissions' => AdminAccess::permissionsForRole($role),
            'scope_type' => $admin->scope_type ?: 'all',
            'outlet_scope' => $admin->scope_type === 'assigned' ? ($admin->outlet_scope ?: []) : [],
            'created_at' => optional($admin->created_at)->toISOString(),
            'updated_at' => optional($admin->updated_at)->toISOString(),
        ];
    }

    private function currentAdmin(Request $request): ?array
    {
        return $request->attributes->get('admin');
    }
}
