<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$request = Illuminate\Http\Request::create('/api/venues', 'GET');
$response = $app->make(Illuminate\Contracts\Http\Kernel::class)->handle($request);
$data = json_decode($response->getContent(), true);

foreach ($data as $venue) {
    echo "ID: " . $venue['id'] . ", Name: " . $venue['name'] . ", display_name: " . ($venue['display_name'] ?? 'null') . ", parent_id: " . ($venue['parent_id'] ?? 'null') . "\n";
    if (!empty($venue['children'])) {
        foreach ($venue['children'] as $child) {
            echo "  -> Child ID: " . $child['id'] . ", Name: " . $child['name'] . ", display_name: " . ($child['display_name'] ?? 'null') . ", parent_id: " . ($child['parent_id'] ?? 'null') . "\n";
        }
    }
}
