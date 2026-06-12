<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\Admin;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    protected AuthService $authService;

    public function __construct(AuthService $authService)
    {
        $this->authService = $authService;
    }

    /**
     * Login admin user
     */
    public function login(LoginRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();
            $result = $this->authService->login($validated['username'], $validated['password']);

            if (!$result) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid credentials'
                ], 401);
            }

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Login failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Admin login for frontend admin panel
     */
    public function adminLogin(Request $request): JsonResponse
    {
        try {
            $credentials = $request->validate([
                'username' => 'required|string',
                'password' => 'required|string'
            ]);

            $result = $this->authService->login($credentials['username'], $credentials['password']);

            if (!$result) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid admin credentials'
                ], 401);
            }

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Admin login failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Logout admin user
     */
    public function logout(Request $request): JsonResponse
    {
        try {
            $result = $this->authService->logout($request->bearerToken() ?: $request->header('X-Admin-Token'));
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Logout failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get current authenticated user
     */
    public function me(Request $request): JsonResponse
    {
        try {
            $result = $this->authService->getCurrentUser($request->bearerToken() ?: $request->header('X-Admin-Token'));
            return response()->json($result, $result['success'] ? 200 : 401);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Show details of an invite activation token
     */
    public function showActivationDetails(string $token): JsonResponse
    {
        $admin = Admin::where('activation_token', $token)
            ->where('activation_expires_at', '>', now())
            ->first();

        if (!$admin) {
            return response()->json([
                'success' => false,
                'message' => 'The activation link is invalid or has expired.'
            ], 400);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'name' => $admin->name,
                'email' => $admin->email,
                'username' => $admin->username,
            ]
        ]);
    }

    /**
     * Activate the user and set their password
     */
    public function activate(Request $request, string $token): JsonResponse
    {
        $validated = $request->validate([
            'password' => 'required|string|min:8|confirmed',
        ]);

        $admin = Admin::where('activation_token', $token)
            ->where('activation_expires_at', '>', now())
            ->first();

        if (!$admin) {
            return response()->json([
                'success' => false,
                'message' => 'The activation link is invalid or has expired.'
            ], 400);
        }

        // Set new password, activate and clean up token
        $admin->password = $validated['password']; // hashed automatically by cast
        $admin->is_active = true;
        $admin->activation_token = null;
        $admin->activation_expires_at = null;
        $admin->email_verified_at = now();
        $admin->save();

        \App\Models\AuditLog::create([
            'action' => 'activated',
            'model_type' => Admin::class,
            'model_id' => $admin->id,
            'new_values' => ['name' => $admin->name, 'email' => $admin->email, 'username' => $admin->username],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Your account has been activated successfully. You can now log in.'
        ]);
    }

    /**
     * Handle forgot password request
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
        ]);

        $admin = Admin::where('email', $validated['email'])->first();

        // Always return success to prevent email enumeration, but only process if admin exists
        if ($admin) {
            $admin->activation_token = \Illuminate\Support\Str::random(60);
            $admin->activation_expires_at = now()->addHours(2);
            $admin->save();

            try {
                \Illuminate\Support\Facades\Mail::to($admin->email)->send(new \App\Mail\AdminActivationInviteMail($admin, true));
            } catch (\Exception $e) {
                \Log::error('Failed to send password reset email: ' . $e->getMessage());
            }

            // Log reset link for local development testing
            $frontendUrl = rtrim(env('FRONTEND_URL', 'http://localhost:5173'), '/');
            $resetLink = $frontendUrl . '/activate/' . $admin->activation_token . '?reset=1';
            \Log::info("Password reset link generated for {$admin->email}: {$resetLink}");
        }

        return response()->json([
            'success' => true,
            'message' => 'If this email is registered, a password reset link has been sent.'
        ]);
    }
}
