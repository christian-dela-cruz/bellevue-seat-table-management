<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('venues', function (Blueprint $table) {
            $table->foreignId('parent_id')->nullable()->after('id')->constrained('venues')->nullOnDelete();
            $table->string('slug')->nullable()->unique()->after('name');
            $table->string('display_name')->nullable()->after('slug');
            $table->string('category')->default('function_room')->after('type');
            $table->integer('display_order')->default(0)->after('image');
            $table->boolean('is_visible')->default(true)->after('is_active');
            $table->boolean('show_on_landing')->default(true)->after('is_visible');
            $table->boolean('reservations_enabled')->default(true)->after('show_on_landing');
            $table->boolean('parent_selectable')->default(true)->after('reservations_enabled');
            $table->boolean('child_selectable')->default(true)->after('parent_selectable');
            $table->string('reservation_route')->nullable()->after('child_selectable');
            $table->string('image_position')->nullable()->after('reservation_route');
            $table->json('metadata')->nullable()->after('image_position');
        });
    }

    public function down(): void
    {
        Schema::table('venues', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
            $table->dropUnique(['slug']);
            $table->dropColumn([
                'parent_id',
                'slug',
                'display_name',
                'category',
                'display_order',
                'is_visible',
                'show_on_landing',
                'reservations_enabled',
                'parent_selectable',
                'child_selectable',
                'reservation_route',
                'image_position',
                'metadata',
            ]);
        });
    }
};
