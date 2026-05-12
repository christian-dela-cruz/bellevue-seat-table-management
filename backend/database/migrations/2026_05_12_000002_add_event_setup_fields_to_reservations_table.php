<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            if (!Schema::hasColumn('reservations', 'event_area')) {
                $table->string('event_area')->nullable();
            }

            if (!Schema::hasColumn('reservations', 'setup_tables')) {
                $table->unsignedInteger('setup_tables')->nullable();
            }

            if (!Schema::hasColumn('reservations', 'setup_chairs')) {
                $table->unsignedInteger('setup_chairs')->nullable();
            }

            if (!Schema::hasColumn('reservations', 'setup_requirements')) {
                $table->text('setup_requirements')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            foreach (['event_area', 'setup_tables', 'setup_chairs', 'setup_requirements'] as $column) {
                if (Schema::hasColumn('reservations', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
