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
        Schema::table('client_display_settings', function (Blueprint $table) {
            $table->string('layout_engine')->default('grid');
            $table->integer('card_width')->default(240);
            $table->boolean('stretch_to_fill')->default(false);
            $table->string('flex_alignment')->default('center');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('client_display_settings', function (Blueprint $table) {
            $table->dropColumn(['layout_engine', 'card_width', 'stretch_to_fill', 'flex_alignment']);
        });
    }
};
