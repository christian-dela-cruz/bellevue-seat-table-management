<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$rooms = App\Models\Reservation::select('room')->distinct()->pluck('room')->toArray();
echo "Unique room names in reservations:\n";
print_r($rooms);

$venues = App\Models\Reservation::select('venue_id')->distinct()->with('venue')->get();
echo "Unique venue associations in reservations:\n";
foreach ($venues as $v) {
    echo "Venue ID: " . $v->venue_id . " -> " . ($v->venue?->name ?? 'NULL') . "\n";
}
