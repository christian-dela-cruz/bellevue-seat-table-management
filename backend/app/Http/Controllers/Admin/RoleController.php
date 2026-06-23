<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Role;
use App\Models\Permission;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class RoleController extends Controller
{
    public function index(Request $request)
    {
        $roles = Role::with('permissions')->orderByDesc('level')->get();
        return response()->json($roles);
    }

    public function permissions()
    {
        $permissions = Permission::orderBy('module')->orderBy('name')->get();
        return response()->json($permissions);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'level' => 'required|integer|min:1',
            'permissions' => 'array',
            'permissions.*' => 'exists:permissions,slug',
        ]);

        $slug = Str::slug($validated['name'], '_');
        
        if (Role::where('slug', $slug)->exists()) {
            $slug = $slug . '_' . time();
        }

        $role = Role::create([
            'name' => $validated['name'],
            'slug' => $slug,
            'description' => $validated['description'] ?? null,
            'level' => $validated['level'],
            'is_system' => false,
        ]);

        if (isset($validated['permissions'])) {
            $permissionIds = Permission::whereIn('slug', $validated['permissions'])->pluck('id')->toArray();
            $role->permissions()->sync($permissionIds);
        }

        $actor = $request->attributes->get('admin');
        \App\Models\AuditLog::create([
            'action' => 'created',
            'model_type' => Role::class,
            'model_id' => $role->id,
            'admin_id' => $actor['id'] ?? null,
            'new_values' => $role->load('permissions')->toArray(),
        ]);

        return response()->json($role, 201);
    }

    public function update(Request $request, $id)
    {
        $role = Role::findOrFail($id);
        
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'level' => 'sometimes|required|integer|min:1',
            'permissions' => 'array',
            'permissions.*' => 'exists:permissions,slug',
        ]);

        $oldValues = $role->load('permissions')->toArray();
        $updateData = [];
        if (isset($validated['name'])) $updateData['name'] = $validated['name'];
        if (isset($validated['description'])) $updateData['description'] = $validated['description'];
        
        // Don't allow changing level of system roles to prevent locking out super admins
        if (isset($validated['level']) && !$role->is_system) {
            $updateData['level'] = $validated['level'];
        }

        $role->update($updateData);

        if (isset($validated['permissions'])) {
            if ($role->is_system) {
                $actor = $request->attributes->get('admin');
                $isSuperAdmin = $actor && (($actor['role'] ?? null) === 'super_admin' || ($actor['id'] ?? null) === 0);
                if (!$isSuperAdmin || $role->slug === 'super_admin') {
                    return response()->json(['message' => 'Cannot modify permissions of system roles'], 403);
                }
            }
            $permissionIds = Permission::whereIn('slug', $validated['permissions'])->pluck('id')->toArray();
            $role->permissions()->sync($permissionIds);
        }
        
        Cache::forget("role_{$role->slug}_permissions");

        $actor = $request->attributes->get('admin');
        \App\Models\AuditLog::create([
            'action' => 'updated',
            'model_type' => Role::class,
            'model_id' => $role->id,
            'admin_id' => $actor['id'] ?? null,
            'old_values' => $oldValues,
            'new_values' => $role->fresh()->load('permissions')->toArray(),
        ]);

        return response()->json($role->load('permissions'));
    }

    public function destroy($id)
    {
        $role = Role::findOrFail($id);
        
        if ($role->is_system) {
            return response()->json(['message' => 'System roles cannot be deleted'], 403);
        }

        if (\App\Models\Admin::where('role', $role->slug)->exists()) {
            return response()->json(['message' => 'Cannot delete role assigned to users'], 400);
        }

        $oldValues = $role->toArray();
        
        Cache::forget("role_{$role->slug}_permissions");
        $role->delete();

        $actor = $request->attributes->get('admin');
        \App\Models\AuditLog::create([
            'action' => 'deleted',
            'model_type' => Role::class,
            'model_id' => $role->id,
            'admin_id' => $actor['id'] ?? null,
            'old_values' => $oldValues,
        ]);

        return response()->json(null, 204);
    }
}
