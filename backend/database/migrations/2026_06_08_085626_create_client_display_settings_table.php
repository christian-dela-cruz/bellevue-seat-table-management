<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('client_display_settings', function (Blueprint $table) {
            $table->id();
            $table->string('section')->unique()->comment('e.g., dining, events');
            $table->integer('desktop_columns')->default(3);
            $table->integer('tablet_columns')->default(2);
            $table->integer('mobile_columns')->default(1);
            $table->integer('visible_rows')->nullable();
            $table->string('card_size')->default('standard');
            $table->json('ordered_ids')->nullable()->comment('Array of venue IDs in desired order');
            $table->json('hidden_ids')->nullable()->comment('Array of venue IDs hidden from client');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('client_display_settings');
    }
};
