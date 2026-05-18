<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Admin;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $password = env('SEED_ADMIN_PASSWORD', 'Password123!');

        $accounts = [
            [
                'name' => 'Super Admin',
                'email' => 'super.admin@example.com',
                'username' => 'super.admin@example.com',
                'role' => 'super_admin',
                'scope_type' => 'all',
                'outlet_scope' => [],
            ],
            [
                'name' => 'System Admin',
                'email' => 'admin@example.com',
                'username' => 'admin@example.com',
                'role' => 'admin',
                'scope_type' => 'all',
                'outlet_scope' => [],
            ],
            [
                'name' => 'F&B Director',
                'email' => 'fb.director@example.com',
                'username' => 'fb.director@example.com',
                'role' => 'fb_director',
                'scope_type' => 'all',
                'outlet_scope' => [],
            ],
            [
                'name' => 'Outlet Manager',
                'email' => 'outlet.manager@example.com',
                'username' => 'outlet.manager@example.com',
                'role' => 'outlet_manager',
                'scope_type' => 'assigned',
                'outlet_scope' => [1],
            ],
            [
                'name' => 'Supervisor User',
                'email' => 'supervisor@example.com',
                'username' => 'supervisor@example.com',
                'role' => 'supervisor',
                'scope_type' => 'assigned',
                'outlet_scope' => [1],
            ],
            [
                'name' => 'Staff User',
                'email' => 'staff@example.com',
                'username' => 'staff@example.com',
                'role' => 'staff',
                'scope_type' => 'assigned',
                'outlet_scope' => [1],
            ],
            [
                'name' => 'Viewer User',
                'email' => 'viewer@example.com',
                'username' => 'viewer@example.com',
                'role' => 'viewer',
                'scope_type' => 'assigned',
                'outlet_scope' => [1],
            ],
        ];

        foreach ($accounts as $account) {
            Admin::updateOrCreate(
                ['username' => $account['username']],
                [
                    ...$account,
                    'password' => Hash::make($password),
                ]
            );
        }
    }
}
