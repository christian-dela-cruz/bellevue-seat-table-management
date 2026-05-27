<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$mappings = [
    1 => 8,  // Alabang Function Room
    2 => 9,  // Laguna Ballroom
    3 => 12, // 20/20 Function Room
    4 => 24, // Business Center
    5 => 20, // Tower Ballroom
    6 => 25, // Qsina Restaurant
    7 => 26, // Hanakazu Japanese Restaurant
];

foreach ($mappings as $oldId => $newId) {
    echo "Processing old ID $oldId to new ID $newId...\n";

    // Re-link reservations
    $resCount = DB::table('reservations')->where('venue_id', $oldId)->update(['venue_id' => $newId]);
    echo "  Re-linked $resCount reservations.\n";

    // Re-link seats
    $seatCount = DB::table('seats')->where('venue_id', $oldId)->update(['venue_id' => $newId]);
    echo "  Re-linked $seatCount seats.\n";

    // Re-link child venues if any parent_id points to old ID
    $childCount = DB::table('venues')->where('parent_id', $oldId)->update(['parent_id' => $newId]);
    echo "  Re-linked $childCount child venues.\n";

    // Delete duplicate venue
    DB::table('venues')->where('id', $oldId)->delete();
    echo "  Deleted old venue ID $oldId.\n";
}

echo "Database cleanup completed successfully!\n";
