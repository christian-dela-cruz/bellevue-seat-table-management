<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Middleware\AdminAccess;
use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\AdminSession;
use App\Models\AdminEmailChange;
use App\Mail\AdminEmailChangeVerificationMail;
use App\Mail\AdminActivationInviteMail;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Cache;
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
            'password' => ['nullable', 'string', 'min:8'],
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

        // Generate activation token and expires
        $activationToken = \Illuminate\Support\Str::random(60);
        $activationExpires = now()->addDays(2);
        $dummyPassword = \Illuminate\Support\Str::random(32);

        $admin = new Admin([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'username' => $validated['username'],
            'password' => $dummyPassword,
            'role' => AdminAccess::normalizeRole($validated['role']),
            'scope_type' => $scopeType,
            'outlet_scope' => $scopeType === 'assigned'
                ? array_values($validated['outlet_scope'] ?? [])
                : [],
            'is_active' => false,
        ]);
        
        $admin->activation_token = $activationToken;
        $admin->activation_expires_at = $activationExpires;
        $admin->save();

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

        // Send welcome activation email
        try {
            Mail::to($admin->email)->send(new AdminActivationInviteMail($admin));
        } catch (\Exception $e) {
            \Log::error('Failed to send admin activation invite email: ' . $e->getMessage());
        }

        // Log the activation link for easy local testing/verification
        $frontendUrl = rtrim(env('FRONTEND_URL', 'http://localhost:5173'), '/');
        $activationLink = $frontendUrl . '/activate/' . $activationToken;
        \Log::info("Admin activation invite generated for {$admin->email}: {$activationLink}");

        return response()->json([
            'success' => true,
            'message' => 'Admin account created successfully. Invitation email sent.',
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
        ];

        // Ensure username updates check the password first
        $usernameChanged = $validated['username'] !== $admin->username;
        if ($usernameChanged || !empty($validated['password'])) {
            if (empty($validated['current_password']) || !Hash::check($validated['current_password'], $admin->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Current password is required to change username or password.',
                ], 422);
            }
            if ($usernameChanged) {
                $updates['username'] = $validated['username'];
            }
            if (!empty($validated['password'])) {
                $updates['password'] = $validated['password'];
            }
        }

        // We do NOT update email here if it changed. Direct email updates must go through verify OTP routes.
        // We only allow it here if it matches the current email to avoid throwing validator errors.
        if ($validated['email'] === $admin->email) {
            $updates['email'] = $validated['email'];
        } else {
            // Log a warning or simply notify that email changes require verification
            \Log::info("Ignoring direct email update request in updateProfile for admin ID: " . $admin->id);
        }

        $admin->update($updates);
        
        // Log to audit log
        \App\Models\AuditLog::create([
            'action' => 'updated_profile',
            'model_type' => Admin::class,
            'model_id' => $admin->id,
            'admin_id' => $admin->id,
            'ip_address' => $request->ip(),
        ]);

        // Sync admin payload in cache
        $token = $request->bearerToken() ?: $request->header('X-Admin-Token');
        if ($token) {
            $payload = $this->authService->adminPayload($admin->fresh());
            Cache::put('admin_token:' . hash('sha256', $token), $payload, now()->addHours(8));
        }

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'admin' => $this->authService->adminPayload($admin->fresh()),
        ]);
    }

    public function myAuditLogs(Request $request): JsonResponse
    {
        $actor = $this->currentAdmin($request);
        $logs = AuditLog::where('admin_id', $actor['id'])
            ->orderBy('created_at', 'desc')
            ->limit(15)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'model_type' => basename(str_replace('\\', '/', $log->model_type)),
                    'ip_address' => $log->ip_address,
                    'created_at' => $log->created_at->toISOString(),
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $logs,
        ]);
    }

    public function activeSessions(Request $request): JsonResponse
    {
        $actor = $this->currentAdmin($request);
        $token = $request->bearerToken() ?: $request->header('X-Admin-Token');
        $currentTokenHash = hash('sha256', $token ?: '');

        $sessions = AdminSession::where('admin_id', $actor['id'])
            ->orderBy('last_active_at', 'desc')
            ->get()
            ->map(function ($session) use ($currentTokenHash) {
                return [
                    'id' => $session->id,
                    'ip_address' => $session->ip_address,
                    'device' => $this->parseUserAgent($session->user_agent),
                    'last_active_at' => $session->last_active_at ? $session->last_active_at->toISOString() : null,
                    'is_current' => $session->token_hash === $currentTokenHash,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $sessions,
        ]);
    }

    private function parseUserAgent($userAgent): string
    {
        if (empty($userAgent)) return 'Unknown Device';
        
        $os = 'Unknown OS';
        if (preg_match('/windows/i', $userAgent)) $os = 'Windows';
        elseif (preg_match('/macintosh|mac os x/i', $userAgent)) $os = 'macOS';
        elseif (preg_match('/iphone|ipad|ipod/i', $userAgent)) $os = 'iOS';
        elseif (preg_match('/android/i', $userAgent)) $os = 'Android';
        elseif (preg_match('/linux/i', $userAgent)) $os = 'Linux';
        
        $browser = 'Unknown Browser';
        if (preg_match('/chrome/i', $userAgent) && !preg_match('/edge|edg/i', $userAgent)) $browser = 'Chrome';
        elseif (preg_match('/safari/i', $userAgent) && !preg_match('/chrome/i', $userAgent)) $browser = 'Safari';
        elseif (preg_match('/firefox/i', $userAgent)) $browser = 'Firefox';
        elseif (preg_match('/edge|edg/i', $userAgent)) $browser = 'Edge';
        elseif (preg_match('/msie|trident/i', $userAgent)) $browser = 'Internet Explorer';
        
        return "{$browser} on {$os}";
    }

    public function revokeSession(Request $request, $id): JsonResponse
    {
        $actor = $this->currentAdmin($request);
        $session = AdminSession::where('admin_id', $actor['id'])->where('id', $id)->first();
        
        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found.',
            ], 404);
        }

        $token = $request->bearerToken() ?: $request->header('X-Admin-Token');
        if ($session->token_hash === hash('sha256', $token ?: '')) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot revoke your active current session.',
            ], 400);
        }

        $session->delete();
        Cache::forget('admin_token:' . $session->token_hash);

        AuditLog::create([
            'action' => 'revoked_session',
            'model_type' => Admin::class,
            'model_id' => $actor['id'],
            'admin_id' => $actor['id'],
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Session revoked successfully.',
        ]);
    }

    public function verifyPassword(Request $request): JsonResponse
    {
        $actor = $this->currentAdmin($request);
        $admin = Admin::findOrFail($actor['id']);

        $request->validate([
            'password' => ['required', 'string'],
        ]);

        if (!Hash::check($request->password, $admin->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Current password is incorrect.',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Password verified successfully.',
        ]);
    }

    public function requestEmailChange(Request $request): JsonResponse
    {
        $actor = $this->currentAdmin($request);
        $admin = Admin::findOrFail($actor['id']);

        $request->validate([
            'new_email' => ['required', 'email', 'max:255', 'unique:admins,email'],
            'password' => ['required', 'string'],
        ]);

        if (!Hash::check($request->password, $admin->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Current password is incorrect.',
            ], 422);
        }

        $code = str_pad((string) random_int(100000, 999999), 6, '0', STR_PAD_LEFT);

        AdminEmailChange::updateOrCreate(
            ['admin_id' => $admin->id],
            [
                'new_email' => $request->new_email,
                'code' => Hash::make($code),
                'expires_at' => now()->addMinutes(15),
            ]
        );

        try {
            Mail::to($request->new_email)->send(new AdminEmailChangeVerificationMail($code, $admin->name));
        } catch (\Exception $e) {
            \Log::error('Failed to send email verification code: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to send verification email. Please check your mail settings.',
            ], 500);
        }

        \Log::info("Email change verification code generated for admin ID {$admin->id} ({$request->new_email}): {$code}");

        return response()->json([
            'success' => true,
            'message' => 'Verification code sent successfully to your new email.',
        ]);
    }

    public function confirmEmailChange(Request $request): JsonResponse
    {
        $actor = $this->currentAdmin($request);
        $admin = Admin::findOrFail($actor['id']);

        $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $pendingChange = AdminEmailChange::where('admin_id', $admin->id)->first();

        if (!$pendingChange) {
            return response()->json([
                'success' => false,
                'message' => 'No email change request found for this account.',
            ], 404);
        }

        if ($pendingChange->expires_at->isPast()) {
            $pendingChange->delete();
            return response()->json([
                'success' => false,
                'message' => 'Verification code has expired. Please request a new code.',
            ], 422);
        }

        if (!Hash::check($request->code, $pendingChange->code)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid verification code.',
            ], 422);
        }

        $oldEmail = $admin->email;
        $newEmail = $pendingChange->new_email;

        $admin->update(['email' => $newEmail]);
        $pendingChange->delete();

        AuditLog::create([
            'action' => 'updated_email',
            'model_type' => Admin::class,
            'model_id' => $admin->id,
            'admin_id' => $admin->id,
            'old_values' => ['email' => $oldEmail],
            'new_values' => ['email' => $newEmail],
            'ip_address' => $request->ip(),
        ]);

        $token = $request->bearerToken() ?: $request->header('X-Admin-Token');
        if ($token) {
            $payload = $this->authService->adminPayload($admin->fresh());
            Cache::put('admin_token:' . hash('sha256', $token), $payload, now()->addHours(8));
        }

        return response()->json([
            'success' => true,
            'message' => 'Email address updated successfully.',
            'admin' => $this->authService->adminPayload($admin->fresh()),
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

    public function setup2FA(Request $request): JsonResponse
    {
        $actor = $this->currentAdmin($request);
        $admin = Admin::findOrFail($actor['id']);

        $secret = \App\Services\Google2FAService::generateSecret();
        $provisioningUri = \App\Services\Google2FAService::getProvisioningUri($admin->username ?: $admin->email, $secret);
        $qrUrl = 'https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=' . urlencode($provisioningUri);

        return response()->json([
            'success' => true,
            'secret' => $secret,
            'qr_url' => $qrUrl,
        ]);
    }

    public function enable2FA(Request $request): JsonResponse
    {
        $actor = $this->currentAdmin($request);
        $admin = Admin::findOrFail($actor['id']);

        $validated = $request->validate([
            'secret' => ['required', 'string', 'size:16'],
            'code' => ['required', 'string', 'size:6'],
        ]);

        $verified = \App\Services\Google2FAService::verifyCode($validated['secret'], $validated['code']);

        if (!$verified) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid verification code. Please check your authenticator app.',
            ], 422);
        }

        $recoveryCodes = [];
        for ($i = 0; $i < 8; $i++) {
            $recoveryCodes[] = \Illuminate\Support\Str::random(10);
        }

        $admin->update([
            'two_factor_enabled' => true,
            'two_factor_secret' => $validated['secret'],
            'two_factor_recovery_codes' => $recoveryCodes,
        ]);

        AuditLog::create([
            'action' => 'enabled_2fa',
            'model_type' => Admin::class,
            'model_id' => $admin->id,
            'admin_id' => $admin->id,
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Two-factor authentication has been enabled.',
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    public function disable2FA(Request $request): JsonResponse
    {
        $actor = $this->currentAdmin($request);
        $admin = Admin::findOrFail($actor['id']);

        $validated = $request->validate([
            'password' => ['required', 'string'],
        ]);

        if (!Hash::check($validated['password'], $admin->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Incorrect password.',
            ], 422);
        }

        $admin->update([
            'two_factor_enabled' => false,
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
        ]);

        AuditLog::create([
            'action' => 'disabled_2fa',
            'model_type' => Admin::class,
            'model_id' => $admin->id,
            'admin_id' => $admin->id,
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Two-factor authentication has been disabled.',
        ]);
    }

    private function currentAdmin(Request $request): ?array
    {
        return $request->attributes->get('admin');
    }
}
