<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('reservations')) {
            Schema::table('reservations', function (Blueprint $table) {
                if (!Schema::hasColumn('reservations', 'assigned_admin_id')) {
                    $table->unsignedBigInteger('assigned_admin_id')->nullable()->after('cancelled_at');
                }
                if (!Schema::hasColumn('reservations', 'assigned_handler_name')) {
                    $table->string('assigned_handler_name')->nullable()->after('assigned_admin_id');
                }
                if (!Schema::hasColumn('reservations', 'coordination_status')) {
                    $table->string('coordination_status')->default('unassigned')->after('assigned_handler_name');
                }
                if (!Schema::hasColumn('reservations', 'internal_notes')) {
                    $table->text('internal_notes')->nullable()->after('coordination_status');
                }
                if (!Schema::hasColumn('reservations', 'handoff_notes')) {
                    $table->text('handoff_notes')->nullable()->after('internal_notes');
                }
                if (!Schema::hasColumn('reservations', 'seen_by')) {
                    $table->json('seen_by')->nullable()->after('handoff_notes');
                }
                if (!Schema::hasColumn('reservations', 'last_handled_by_id')) {
                    $table->unsignedBigInteger('last_handled_by_id')->nullable()->after('seen_by');
                }
                if (!Schema::hasColumn('reservations', 'last_handled_by_name')) {
                    $table->string('last_handled_by_name')->nullable()->after('last_handled_by_id');
                }
                if (!Schema::hasColumn('reservations', 'last_operational_action')) {
                    $table->string('last_operational_action')->nullable()->after('last_handled_by_name');
                }
                if (!Schema::hasColumn('reservations', 'last_operational_at')) {
                    $table->timestamp('last_operational_at')->nullable()->after('last_operational_action');
                }
            });
        }

        if (Schema::hasTable('reservation_transactions')) {
            Schema::table('reservation_transactions', function (Blueprint $table) {
                if (!Schema::hasColumn('reservation_transactions', 'actor_admin_id')) {
                    $table->unsignedBigInteger('actor_admin_id')->nullable()->after('reservation_id');
                }
                if (!Schema::hasColumn('reservation_transactions', 'actor_name')) {
                    $table->string('actor_name')->nullable()->after('actor_admin_id');
                }
                if (!Schema::hasColumn('reservation_transactions', 'actor_role')) {
                    $table->string('actor_role')->nullable()->after('actor_name');
                }
                if (!Schema::hasColumn('reservation_transactions', 'actor_email')) {
                    $table->string('actor_email')->nullable()->after('actor_role');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('reservation_transactions')) {
            Schema::table('reservation_transactions', function (Blueprint $table) {
                foreach (['actor_email', 'actor_role', 'actor_name', 'actor_admin_id'] as $column) {
                    if (Schema::hasColumn('reservation_transactions', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        if (Schema::hasTable('reservations')) {
            Schema::table('reservations', function (Blueprint $table) {
                foreach ([
                    'last_operational_at',
                    'last_operational_action',
                    'last_handled_by_name',
                    'last_handled_by_id',
                    'seen_by',
                    'handoff_notes',
                    'internal_notes',
                    'coordination_status',
                    'assigned_handler_name',
                    'assigned_admin_id',
                ] as $column) {
                    if (Schema::hasColumn('reservations', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
