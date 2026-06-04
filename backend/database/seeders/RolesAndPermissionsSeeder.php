<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\Permission;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $permissions = [
            'view_admin' => 'View Admin Panel',
            'manage_reservations' => 'Manage Reservations',
            'adjust_reservation_details' => 'Adjust Reservation Details',
            'delete_reservations' => 'Delete Reservations',
            'acknowledge_notifications' => 'Acknowledge Notifications',
            'manage_seat_maps' => 'Manage Seat Maps',
            'manage_venues' => 'Manage Venues',
            'view_outlet_reports' => 'View Outlet Reports',
            'view_global_reports' => 'View Global Reports',
            'view_transactions' => 'View Transactions',
            'manage_accounts' => 'Manage Accounts',
            'manage_users' => 'Manage System Users',
        ];

        foreach ($permissions as $slug => $name) {
            Permission::firstOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'module' => 'System']
            );
        }

        $rolesData = [
            'super_admin' => [
                'name' => 'Super Admin',
                'description' => 'Full system access',
                'level' => 100,
                'is_system' => true,
                'permissions' => array_keys($permissions), // All permissions
            ],
            'admin' => [
                'name' => 'Admin',
                'description' => 'System administrator',
                'level' => 90,
                'is_system' => true,
                'permissions' => [
                    'view_admin', 'manage_reservations', 'adjust_reservation_details',
                    'delete_reservations', 'acknowledge_notifications', 'manage_seat_maps',
                    'manage_venues', 'view_outlet_reports', 'view_transactions', 'manage_accounts'
                ],
            ],
            'fb_director' => [
                'name' => 'F&B Director',
                'description' => 'Food & Beverage Director',
                'level' => 80,
                'is_system' => true,
                'permissions' => [
                    'view_admin', 'view_outlet_reports', 'view_global_reports', 'view_transactions'
                ],
            ],
            'outlet_manager' => [
                'name' => 'Outlet Manager',
                'description' => 'Manager of a specific outlet',
                'level' => 70,
                'is_system' => true,
                'permissions' => [
                    'view_admin', 'manage_reservations', 'adjust_reservation_details',
                    'acknowledge_notifications', 'view_outlet_reports', 'view_transactions'
                ],
            ],
            'supervisor' => [
                'name' => 'Supervisor',
                'description' => 'Shift supervisor',
                'level' => 60,
                'is_system' => true,
                'permissions' => [
                    'view_admin', 'manage_reservations', 'adjust_reservation_details',
                    'acknowledge_notifications', 'view_outlet_reports', 'view_transactions'
                ],
            ],
            'staff' => [
                'name' => 'Staff',
                'description' => 'General staff',
                'level' => 50,
                'is_system' => true,
                'permissions' => [
                    'view_admin', 'acknowledge_notifications'
                ],
            ],
            'viewer' => [
                'name' => 'Viewer',
                'description' => 'View only access',
                'level' => 10,
                'is_system' => true,
                'permissions' => [
                    'view_admin'
                ],
            ],
        ];

        foreach ($rolesData as $slug => $data) {
            $role = Role::firstOrCreate(
                ['slug' => $slug],
                [
                    'name' => $data['name'],
                    'description' => $data['description'],
                    'level' => $data['level'],
                    'is_system' => $data['is_system'],
                ]
            );

            $permissionIds = Permission::whereIn('slug', $data['permissions'])->pluck('id')->toArray();
            $role->permissions()->sync($permissionIds);
        }
    }
}
