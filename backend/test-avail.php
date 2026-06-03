<?php
use App\Models\Reservation;
use App\Models\Venue;

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$venue = Venue::where('name', 'like', '%Alabang%')->first();
if (!$venue) {
    echo "Venue not found\n";
    exit;
}

echo "Venue: " . $venue->name . " (ID: " . $venue->id . ", Parent: " . ($venue->parent_id ?? 'None') . ")\n";

$reservations = Reservation::whereDate('event_date', '2026-06-24')->get();
echo "Total reservations on 2026-06-24: " . $reservations->count() . "\n";
foreach ($reservations as $r) {
    echo "- ID: {$r->id}, Name: {$r->name}, Room: {$r->room}, Table: {$r->table_number}, Seats: {$r->seat_number}, Type: {$r->type}, Status: {$r->status}, Standalone: " . ($r->is_standalone ? 'Yes' : 'No') . "\n";
}
