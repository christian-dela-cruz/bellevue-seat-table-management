<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

foreach (App\Models\Venue::all() as $v) {
    echo $v->id . ': ' . $v->name . ' (parent_id: ' . ($v->parent_id ?? 'null') . ', active: ' . ($v->is_active ? 'Y' : 'N') . ', archived: ' . ($v->is_archived ? 'Y' : 'N') . ', type: ' . $v->type . ', slug: ' . ($v->slug ?: 'EMPTY') . ', display_name: ' . ($v->display_name ?: 'EMPTY') . ', reservation_route: ' . ($v->reservation_route ?: 'NULL') . ")\n";
}
