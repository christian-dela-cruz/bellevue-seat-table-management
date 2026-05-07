<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            if (!Schema::hasColumn('reservations', 'reservation_state')) {
                $table->string('reservation_state')->default('active')->after('status');
            }
        });

        DB::table('reservations')
            ->whereIn('status', ['rejected', 'cancelled'])
            ->update(['reservation_state' => 'inactive']);

        DB::table('reservations')
            ->whereNotIn('status', ['rejected', 'cancelled'])
            ->update(['reservation_state' => 'active']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            if (Schema::hasColumn('reservations', 'reservation_state')) {
                $table->dropColumn('reservation_state');
            }
        });
    }
};
