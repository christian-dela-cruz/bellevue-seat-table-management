<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            if (!Schema::hasColumn('reservations', 'previous_status')) {
                $table->string('previous_status')->nullable();
            }

            if (!Schema::hasColumn('reservations', 'status_last_changed_at')) {
                $table->timestamp('status_last_changed_at')->nullable();
            }

            if (!Schema::hasColumn('reservations', 'rejected_at')) {
                $table->timestamp('rejected_at')->nullable();
            }

            if (!Schema::hasColumn('reservations', 'reverted_at')) {
                $table->timestamp('reverted_at')->nullable();
            }
        });

        DB::table('reservations')
            ->whereNull('status_last_changed_at')
            ->update(['status_last_changed_at' => DB::raw('updated_at')]);

        DB::table('reservations')
            ->where('status', 'rejected')
            ->whereNull('rejected_at')
            ->update(['rejected_at' => DB::raw('updated_at')]);
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            foreach (['previous_status', 'status_last_changed_at', 'rejected_at', 'reverted_at'] as $column) {
                if (Schema::hasColumn('reservations', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
