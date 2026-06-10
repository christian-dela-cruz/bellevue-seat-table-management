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
        Schema::table('reservations', function (Blueprint $table) {
            $table->string('pricing_mode')->nullable();
            $table->decimal('base_price', 10, 2)->default(0);
            $table->decimal('price_per_person', 10, 2)->default(0);
            $table->decimal('price_per_seat', 10, 2)->default(0);
            $table->string('package_name')->nullable();
            $table->decimal('package_price', 10, 2)->default(0);
            $table->decimal('calculated_price', 10, 2)->default(0);
            $table->decimal('manual_price_override', 10, 2)->nullable();
            $table->decimal('final_price', 10, 2)->default(0);
            $table->text('price_notes')->nullable();
            $table->boolean('show_price_to_guest')->default(false);
            $table->unsignedBigInteger('pricing_updated_by')->nullable();
            $table->timestamp('pricing_updated_at')->nullable();

            $table->foreign('pricing_updated_by')->references('id')->on('admins')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropForeign(['pricing_updated_by']);
            $table->dropColumn([
                'pricing_mode',
                'base_price',
                'price_per_person',
                'price_per_seat',
                'package_name',
                'package_price',
                'calculated_price',
                'manual_price_override',
                'final_price',
                'price_notes',
                'show_price_to_guest',
                'pricing_updated_by',
                'pricing_updated_at',
            ]);
        });
    }
};
