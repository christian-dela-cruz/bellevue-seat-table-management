<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->foreignId('assigned_room_id')->nullable()->after('venue_id')->constrained('venues')->nullOnDelete();
            $table->string('public_room_name')->nullable()->after('room');
            $table->string('internal_room_name')->nullable()->after('public_room_name');
            $table->string('assignment_status')->default('pending_assignment')->after('internal_notes');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            if (DB::getDriverName() !== 'sqlite') {
                $table->dropForeign(['assigned_room_id']);
            }
            $table->dropColumn([
                'assigned_room_id',
                'public_room_name',
                'internal_room_name',
                'assignment_status',
            ]);
        });
    }
};
