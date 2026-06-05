<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Venue;

class VenueSeeder extends Seeder
{
    public function run(): void
    {
        $parents = [
            [
                'name' => 'Alabang Function Room',
                'slug' => 'alabang-function-room',
                'wing' => 'Main Wing',
                'capacity' => 100,
                'description' => 'Elegant function room perfect for corporate events and special occasions.',
                'image' => 'afc.jpeg',
                'display_order' => 10,
                'reservation_route' => '/alabang-reserve',
            ],
            [
                'name' => 'Laguna Ballroom',
                'slug' => 'laguna-ballroom',
                'wing' => 'Main Wing',
                'capacity' => 200,
                'description' => 'Spacious ballroom with panoramic views of Laguna Bay.',
                'image' => 'laguna.jpeg',
                'display_order' => 20,
                'reservation_route' => '/laguna-reserv1e',
                'children' => [
                    ['name' => 'Laguna Ballroom 1', 'slug' => 'laguna-ballroom-1', 'display_name' => 'Laguna 1', 'reservation_route' => '/laguna-reserv1e', 'display_order' => 21],
                    ['name' => 'Laguna Ballroom 2', 'slug' => 'laguna-ballroom-2', 'display_name' => 'Laguna 2', 'reservation_route' => '/laguna-reserv2e', 'display_order' => 22],
                ],
            ],
            [
                'name' => '20/20 Function Room',
                'slug' => '20-20-function-room',
                'wing' => 'Main Wing',
                'capacity' => 50,
                'description' => 'Intimate setting for smaller gatherings and meetings.',
                'image' => '20-20.jpeg',
                'display_order' => 30,
                'reservation_route' => '/twenty-twenty-a',
                'children' => [
                    ['name' => '20/20 Function Room A', 'slug' => '20-20-function-room-a', 'display_name' => 'A', 'reservation_route' => '/twenty-twenty-a', 'display_order' => 31],
                    ['name' => '20/20 Function Room B', 'slug' => '20-20-function-room-b', 'display_name' => 'B', 'reservation_route' => '/twenty-twenty-b', 'display_order' => 32],
                    ['name' => '20/20 Function Room C', 'slug' => '20-20-function-room-c', 'display_name' => 'C', 'reservation_route' => '/twenty-twenty-c', 'display_order' => 33],
                ],
            ],
            [
                'name' => 'Grand Ballroom',
                'slug' => 'grand-ballroom',
                'wing' => 'Tower Wing',
                'capacity' => 300,
                'description' => 'Grand event space for weddings, galas, and large celebrations.',
                'image' => 'grandroom-1.jpg',
                'display_order' => 40,
                'reservation_route' => '/grand-ballroom-a',
                'children' => [
                    ['name' => 'Grand Ballroom A', 'slug' => 'grand-ballroom-a', 'display_name' => 'A', 'reservation_route' => '/grand-ballroom-a', 'display_order' => 41],
                    ['name' => 'Grand Ballroom B', 'slug' => 'grand-ballroom-b', 'display_name' => 'B', 'reservation_route' => '/grand-ballroom-b', 'display_order' => 42],
                    ['name' => 'Grand Ballroom C', 'slug' => 'grand-ballroom-c', 'display_name' => 'C', 'reservation_route' => '/grand-ballroom-c', 'display_order' => 43],
                ],
            ],
            [
                'name' => 'Tower Ballroom',
                'slug' => 'tower-ballroom',
                'wing' => 'Tower Wing',
                'capacity' => 300,
                'description' => 'Grand ballroom on tower level with city views.',
                'image' => 'towerb.jpeg',
                'display_order' => 50,
                'reservation_route' => '/tower1',
                'children' => [
                    ['name' => 'Tower 1', 'slug' => 'tower-1', 'display_name' => '1', 'reservation_route' => '/tower1', 'display_order' => 51],
                    ['name' => 'Tower 2', 'slug' => 'tower-2', 'display_name' => '2', 'reservation_route' => '/tower2', 'display_order' => 52],
                    ['name' => 'Tower 3', 'slug' => 'tower-3', 'display_name' => '3', 'reservation_route' => '/tower3', 'display_order' => 53],
                ],
            ],
            [
                'name' => 'Business Center',
                'slug' => 'business-center',
                'wing' => 'Main Wing',
                'capacity' => 30,
                'description' => 'Professional space for business meetings and conferences.',
                'image' => 'bc.jpeg',
                'display_order' => 60,
                'reservation_route' => '/business-center-reserve',
            ],
        ];

        foreach ($parents as $item) {
            $children = $item['children'] ?? [];
            unset($item['children']);

            $parent = $this->upsertVenue($item);

            foreach ($children as $child) {
                $this->upsertVenue([
                    ...$child,
                    'parent_id' => $parent->id,
                    'wing' => $item['wing'],
                    'capacity' => $item['capacity'],
                    'description' => $child['name'],
                    'image' => $item['image'],
                    'show_on_landing' => false,
                ]);
            }
        }

        $this->upsertVenue([
            'name' => 'Qsina Restaurant',
            'slug' => 'qsina-restaurant',
            'wing' => 'Dining',
            'type' => 'dining',
            'category' => 'dining',
            'capacity' => 80,
            'price_per_hour' => 0.00,
            'description' => 'Fine dining restaurant serving international cuisine.',
            'image' => 'qsina.jpeg',
            'display_order' => 100,
            'reservation_route' => '/qsina',
        ]);

        $this->upsertVenue([
            'name' => 'Hanakazu Japanese Restaurant',
            'slug' => 'hanakazu-japanese-restaurant',
            'wing' => 'Dining',
            'type' => 'dining',
            'category' => 'dining',
            'capacity' => 81,
            'price_per_hour' => 0.00,
            'description' => 'Authentic Japanese restaurant with teppanyaki stations.',
            'image' => 'hanakazu.jpeg',
            'display_order' => 101,
            'reservation_route' => '/hanakazu',
        ]);

        $this->upsertVenue([
            'name' => 'Phoenix Court',
            'slug' => 'phoenix-court',
            'wing' => 'Dining',
            'type' => 'dining',
            'category' => 'dining',
            'capacity' => 250,
            'price_per_hour' => 0.00,
            'description' => 'Chinese restaurant dining outlet for table reservations.',
            'image' => 'phoenix-court.webp',
            'display_order' => 102,
            'reservation_route' => '/phoenix-court',
        ]);

        $this->upsertVenue([
            'name' => 'Pastry Corner',
            'slug' => 'pastry-corner',
            'wing' => 'Dining',
            'type' => 'dining',
            'category' => 'dining',
            'capacity' => 50,
            'price_per_hour' => 0.00,
            'description' => 'Pastry Corner',
            'image' => 'function-rooms/pastry-corner-1780045591.png',
            'display_order' => 103,
            'reservation_route' => '/pastry-corner',
        ]);

        $this->upsertVenue([
            'name' => 'Vue Bar',
            'slug' => 'vue-bar',
            'wing' => 'Dining',
            'type' => 'dining',
            'category' => 'dining',
            'capacity' => 100,
            'price_per_hour' => 0.00,
            'description' => 'Vue Bar',
            'image' => 'function-rooms/vue-bar-1780046224.png',
            'display_order' => 104,
            'reservation_route' => '/vue-bar',
        ]);

        $this->upsertVenue([
            'name' => 'Johnny\'s Steak and Grill',
            'slug' => 'johnnys-steak-and-grill',
            'wing' => 'Dining',
            'type' => 'dining',
            'category' => 'dining',
            'capacity' => 80,
            'price_per_hour' => 0.00,
            'description' => 'Johnny\'s Steak and Grill',
            'image' => 'function-rooms/johnny-s-steak-and-grill-1780046070.png',
            'display_order' => 105,
            'reservation_route' => '/johnnys-steak-and-grill',
        ]);
    }

    private function upsertVenue(array $data): Venue
    {
        $values = [
            'parent_id' => $data['parent_id'] ?? null,
            'name' => $data['name'],
            'slug' => $data['slug'],
            'display_name' => $data['display_name'] ?? $data['name'],
            'wing' => $data['wing'],
            'type' => $data['type'] ?? 'function_room',
            'category' => $data['category'] ?? 'function_room',
            'capacity' => $data['capacity'] ?? 0,
            'price_per_hour' => $data['price_per_hour'] ?? 0.00,
            'description' => $data['description'] ?? null,
            'image' => $data['image'] ?? null,
            'display_order' => $data['display_order'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
            'is_archived' => false,
            'archived_at' => null,
            'is_visible' => $data['is_visible'] ?? true,
            'show_on_landing' => $data['show_on_landing'] ?? true,
            'reservations_enabled' => $data['reservations_enabled'] ?? true,
            'parent_selectable' => $data['parent_selectable'] ?? true,
            'child_selectable' => $data['child_selectable'] ?? true,
            'reservation_route' => $data['reservation_route'] ?? null,
            'image_position' => $data['image_position'] ?? null,
        ];

        $venue = Venue::where('slug', $data['slug'])->first()
            ?: Venue::where('name', $data['name'])
                ->where('type', $data['type'] ?? 'function_room')
                ->first();

        if ($venue) {
            $venue->update($values);
            return $venue;
        }

        return Venue::create($values);
    }
}
