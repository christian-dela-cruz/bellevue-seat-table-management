<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('seat_maps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('venue_id')->constrained()->onDelete('cascade');
            $table->string('status')->default('draft'); // draft, published, archived
            $table->longText('payload');
            $table->integer('version_number')->default(1);
            $table->foreignId('created_by')->nullable()->constrained('admins')->nullOnDelete();
            $table->foreignId('published_by')->nullable()->constrained('admins')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['venue_id', 'status']);
        });

        // Migrate existing payload data to new table
        $venues = DB::table('venues')->whereNotNull('seatmap_payload')->get();
        foreach ($venues as $venue) {
            DB::table('seat_maps')->insert([
                'venue_id' => $venue->id,
                'status' => 'published',
                'payload' => $venue->seatmap_payload,
                'version_number' => 1,
                'created_at' => now(),
                'updated_at' => now(),
                'published_at' => now(),
            ]);
        }

        // Drop the old column
        Schema::table('venues', function (Blueprint $table) {
            $table->dropColumn('seatmap_payload');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Re-add the column to venues
        Schema::table('venues', function (Blueprint $table) {
            $table->longText('seatmap_payload')->nullable()->after('is_visible');
        });

        // Migrate data back
        $publishedMaps = DB::table('seat_maps')->where('status', 'published')->get();
        foreach ($publishedMaps as $map) {
            DB::table('venues')->where('id', $map->venue_id)->update([
                'seatmap_payload' => $map->payload
            ]);
        }

        Schema::dropIfExists('seat_maps');
    }
};
