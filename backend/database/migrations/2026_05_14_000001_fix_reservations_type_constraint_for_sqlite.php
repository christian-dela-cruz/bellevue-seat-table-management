<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('reservations')) {
            return;
        }

        $driver = DB::getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE reservations MODIFY COLUMN type ENUM('whole','individual','standalone') NOT NULL DEFAULT 'whole'");
            return;
        }

        if ($driver !== 'sqlite') {
            return;
        }

        $tableDefinition = DB::table('sqlite_master')
            ->where('type', 'table')
            ->where('name', 'reservations')
            ->value('sql');

        if (is_string($tableDefinition) && stripos($tableDefinition, "'standalone'") !== false) {
            return;
        }

        DB::statement('PRAGMA foreign_keys = OFF');

        Schema::create('reservations_temp', function (Blueprint $table) {
            $table->id();
            $table->string('reference_code')->unique();
            $table->string('name');
            $table->string('email');
            $table->string('phone');
            $table->foreignId('venue_id')->constrained()->onDelete('cascade');
            $table->string('room')->nullable();
            $table->string('table_number')->nullable();
            $table->string('seat_number')->nullable();
            $table->string('seat_id')->nullable();
            $table->integer('guests_count');
            $table->dateTime('event_date');
            $table->string('event_time');
            $table->string('event_area')->nullable();
            $table->unsignedInteger('setup_tables')->nullable();
            $table->unsignedInteger('setup_chairs')->nullable();
            $table->text('setup_requirements')->nullable();
            $table->text('special_requests')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected', 'reserved', 'cancelled'])->default('pending');
            $table->string('reservation_state')->default('active');
            $table->string('previous_status')->nullable();
            $table->timestamp('status_last_changed_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('reverted_at')->nullable();
            $table->enum('type', ['whole', 'individual', 'standalone'])->default('whole');
            $table->boolean('is_standalone')->default(false);
            $table->timestamp('submitted_at');
            $table->timestamps();
        });

        DB::statement("
            INSERT INTO reservations_temp (
                id, reference_code, name, email, phone, venue_id, room, table_number, seat_number, seat_id,
                guests_count, event_date, event_time, event_area, setup_tables, setup_chairs, setup_requirements,
                special_requests, rejection_reason, cancellation_reason, cancelled_at, status, reservation_state,
                previous_status, status_last_changed_at, rejected_at, reverted_at, type, is_standalone,
                submitted_at, created_at, updated_at
            )
            SELECT
                id, reference_code, name, email, phone, venue_id, room, table_number, seat_number, seat_id,
                guests_count, event_date, event_time, event_area, setup_tables, setup_chairs, setup_requirements,
                special_requests, rejection_reason, cancellation_reason, cancelled_at, status,
                COALESCE(reservation_state, 'active'),
                previous_status, status_last_changed_at, rejected_at, reverted_at,
                CASE
                    WHEN COALESCE(is_standalone, 0) = 1 OR UPPER(COALESCE(table_number, '')) = 'STANDALONE' THEN 'standalone'
                    WHEN type = 'individual' THEN 'individual'
                    ELSE 'whole'
                END,
                COALESCE(is_standalone, 0),
                submitted_at, created_at, updated_at
            FROM reservations
        ");

        Schema::drop('reservations');
        DB::statement('ALTER TABLE reservations_temp RENAME TO reservations');
        DB::statement('PRAGMA foreign_keys = ON');
    }

    public function down(): void
    {
        if (!Schema::hasTable('reservations')) {
            return;
        }

        $driver = DB::getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE reservations MODIFY COLUMN type ENUM('whole','individual') NOT NULL DEFAULT 'whole'");
            return;
        }

        if ($driver !== 'sqlite') {
            return;
        }

        DB::statement('PRAGMA foreign_keys = OFF');

        Schema::create('reservations_temp', function (Blueprint $table) {
            $table->id();
            $table->string('reference_code')->unique();
            $table->string('name');
            $table->string('email');
            $table->string('phone');
            $table->foreignId('venue_id')->constrained()->onDelete('cascade');
            $table->string('room')->nullable();
            $table->string('table_number')->nullable();
            $table->string('seat_number')->nullable();
            $table->string('seat_id')->nullable();
            $table->integer('guests_count');
            $table->dateTime('event_date');
            $table->string('event_time');
            $table->string('event_area')->nullable();
            $table->unsignedInteger('setup_tables')->nullable();
            $table->unsignedInteger('setup_chairs')->nullable();
            $table->text('setup_requirements')->nullable();
            $table->text('special_requests')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected', 'reserved', 'cancelled'])->default('pending');
            $table->string('reservation_state')->default('active');
            $table->string('previous_status')->nullable();
            $table->timestamp('status_last_changed_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('reverted_at')->nullable();
            $table->enum('type', ['whole', 'individual'])->default('whole');
            $table->boolean('is_standalone')->default(false);
            $table->timestamp('submitted_at');
            $table->timestamps();
        });

        DB::statement("
            INSERT INTO reservations_temp (
                id, reference_code, name, email, phone, venue_id, room, table_number, seat_number, seat_id,
                guests_count, event_date, event_time, event_area, setup_tables, setup_chairs, setup_requirements,
                special_requests, rejection_reason, cancellation_reason, cancelled_at, status, reservation_state,
                previous_status, status_last_changed_at, rejected_at, reverted_at, type, is_standalone,
                submitted_at, created_at, updated_at
            )
            SELECT
                id, reference_code, name, email, phone, venue_id, room, table_number, seat_number, seat_id,
                guests_count, event_date, event_time, event_area, setup_tables, setup_chairs, setup_requirements,
                special_requests, rejection_reason, cancellation_reason, cancelled_at, status,
                COALESCE(reservation_state, 'active'),
                previous_status, status_last_changed_at, rejected_at, reverted_at,
                CASE WHEN type = 'individual' THEN 'individual' ELSE 'whole' END,
                COALESCE(is_standalone, 0),
                submitted_at, created_at, updated_at
            FROM reservations
        ");

        Schema::drop('reservations');
        DB::statement('ALTER TABLE reservations_temp RENAME TO reservations');
        DB::statement('PRAGMA foreign_keys = ON');
    }
};
