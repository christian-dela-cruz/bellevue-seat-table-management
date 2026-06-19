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
        Schema::table('venues', function (Blueprint $table) {
            $table->string('pricing_mode')->nullable()->after('capacity');
            $table->decimal('base_price', 10, 2)->default(0.00)->after('pricing_mode');
            $table->decimal('price_per_person', 10, 2)->default(0.00)->after('base_price');
            $table->decimal('price_per_seat', 10, 2)->default(0.00)->after('price_per_person');
            $table->boolean('show_price_to_guest_default')->default(false)->after('price_per_seat');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('venues', function (Blueprint $table) {
            $table->dropColumn([
                'pricing_mode',
                'base_price',
                'price_per_person',
                'price_per_seat',
                'show_price_to_guest_default',
            ]);
        });
    }
};
