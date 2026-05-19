<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('notification_acknowledgments')) {
            return;
        }

        Schema::create('notification_acknowledgments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reservation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('notification_key')->unique();
            $table->unsignedBigInteger('acknowledged_by_id')->nullable();
            $table->string('acknowledged_by_name')->nullable();
            $table->string('acknowledged_by_role')->nullable();
            $table->string('outlet')->nullable();
            $table->date('event_date')->nullable();
            $table->string('event_time')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['reservation_id', 'acknowledged_at']);
            $table->index(['outlet', 'event_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_acknowledgments');
    }
};
