<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $knownDining = [
        'hanakazu japanese restaurant' => [
            'name' => 'Hanakazu Japanese Restaurant',
            'slug' => 'hanakazu-japanese-restaurant',
            'route' => '/hanakazu',
            'image' => 'hanakazu.jpeg',
            'order' => 101,
            'capacity' => 81,
            'description' => 'Authentic Japanese restaurant with teppanyaki stations.',
        ],
        'qsina restaurant' => [
            'name' => 'Qsina Restaurant',
            'slug' => 'qsina-restaurant',
            'route' => '/qsina',
            'image' => 'qsina.jpeg',
            'order' => 100,
            'capacity' => 80,
            'description' => 'Fine dining restaurant serving international cuisine.',
        ],
        'phoenix court' => [
            'name' => 'Phoenix Court',
            'slug' => 'phoenix-court',
            'route' => '/phoenix-court',
            'image' => 'phoenix-court.webp',
            'order' => 102,
            'capacity' => 250,
            'description' => 'Chinese restaurant dining outlet for table reservations.',
        ],
    ];

    public function up(): void
    {
        if (!Schema::hasTable('venues')) {
            return;
        }

        $this->ensureArchiveColumns();

        foreach ($this->knownDining as $key => $data) {
            $canonical = $this->ensureDiningVenue($key, $data);
            $this->archiveDuplicateDiningVenues($key, $canonical);
        }
    }

    public function down(): void
    {
        // This migration preserves reservation history and only normalizes active venue records.
    }

    private function ensureArchiveColumns(): void
    {
        $needsArchived = !Schema::hasColumn('venues', 'is_archived');
        $needsArchivedAt = !Schema::hasColumn('venues', 'archived_at');

        if (!$needsArchived && !$needsArchivedAt) {
            return;
        }

        Schema::table('venues', function (Blueprint $table) use ($needsArchived, $needsArchivedAt) {
            if ($needsArchived) {
                $table->boolean('is_archived')->default(false)->after('is_active');
            }

            if ($needsArchivedAt) {
                $table->timestamp('archived_at')->nullable()->after('is_archived');
            }
        });
    }

    private function ensureDiningVenue(string $key, array $data): object
    {
        $matches = DB::table('venues')
            ->where('type', 'dining')
            ->where(function ($query) use ($key, $data) {
                $query->where('slug', $data['slug'])
                    ->orWhereRaw('LOWER(name) = ?', [$data['name'] === 'Hanakazu Japanese Restaurant' ? 'hanakazu japanese restaurant' : strtolower($data['name'])])
                    ->orWhereRaw('LOWER(display_name) = ?', [strtolower($data['name'])]);
                if ($key === 'qsina restaurant') {
                    $query->orWhereRaw('LOWER(name) = ?', ['qsina'])
                        ->orWhereRaw('LOWER(display_name) = ?', ['qsina']);
                }
                if ($key === 'hanakazu japanese restaurant') {
                    $query->orWhereRaw('LOWER(name) = ?', ['hanakazu'])
                        ->orWhereRaw('LOWER(display_name) = ?', ['hanakazu']);
                }
            })
            ->get()
            ->all();

        if ($matches) {
            usort($matches, fn ($a, $b) => $this->score($b, $data) <=> $this->score($a, $data));
            $canonical = $matches[0];
            DB::table('venues')->where('id', $canonical->id)->update($this->canonicalValues($data));

            return DB::table('venues')->where('id', $canonical->id)->first();
        }

        $id = DB::table('venues')->insertGetId([
            ...$this->canonicalValues($data),
            'created_at' => Carbon::now(),
        ]);

        return DB::table('venues')->where('id', $id)->first();
    }

    private function archiveDuplicateDiningVenues(string $key, object $canonical): void
    {
        $duplicates = DB::table('venues')
            ->where('type', 'dining')
            ->where('id', '!=', $canonical->id)
            ->where(function ($query) use ($key) {
                foreach ($this->aliasesFor($key) as $alias) {
                    $query->orWhereRaw('LOWER(name) = ?', [$alias])
                        ->orWhereRaw('LOWER(display_name) = ?', [$alias])
                        ->orWhereRaw("LOWER(REPLACE(slug, '-', ' ')) = ?", [$alias])
                        ->orWhereRaw("LOWER(REPLACE(slug, '-', '')) = ?", [$alias]);
                }
            })
            ->get();

        foreach ($duplicates as $duplicate) {
            DB::table('reservations')
                ->where('venue_id', $duplicate->id)
                ->update(['venue_id' => $canonical->id]);

            DB::table('seats')
                ->where('venue_id', $duplicate->id)
                ->update(['venue_id' => $canonical->id]);

            $metadata = $this->metadata($duplicate);
            $metadata['archived_reason'] = 'Duplicate dining venue normalized during Venue Management cleanup.';
            $metadata['canonical_venue_id'] = $canonical->id;
            $metadata['archived_duplicate_id'] = $duplicate->id;

            DB::table('venues')
                ->where('id', $duplicate->id)
                ->update([
                    'is_archived' => true,
                    'archived_at' => Carbon::now(),
                    'is_active' => false,
                    'is_visible' => false,
                    'show_on_landing' => false,
                    'reservations_enabled' => false,
                    'metadata' => json_encode($metadata),
                    'updated_at' => Carbon::now(),
                ]);
        }
    }

    private function canonicalValues(array $data): array
    {
        return [
            'parent_id' => null,
            'name' => $data['name'],
            'display_name' => $data['name'],
            'slug' => $data['slug'],
            'wing' => 'Dining',
            'type' => 'dining',
            'category' => 'dining',
            'capacity' => $data['capacity'],
            'description' => $data['description'],
            'image' => $data['image'],
            'display_order' => $data['order'],
            'is_active' => true,
            'is_archived' => false,
            'archived_at' => null,
            'is_visible' => true,
            'show_on_landing' => true,
            'reservations_enabled' => true,
            'parent_selectable' => true,
            'child_selectable' => true,
            'reservation_route' => $data['route'],
            'updated_at' => Carbon::now(),
        ];
    }

    private function aliasesFor(string $key): array
    {
        return match ($key) {
            'hanakazu japanese restaurant' => ['hanakazu japanese restaurant', 'hanakazu', 'hanakazujapaneserestaurant'],
            'qsina restaurant' => ['qsina restaurant', 'qsina', 'qsinarestaurant'],
            'phoenix court' => ['phoenix court', 'phoenixcourt'],
            default => [$key, str_replace(' ', '', $key)],
        };
    }

    private function score(object $venue, array $data): int
    {
        $score = 0;
        $score += $venue->slug === $data['slug'] ? 100 : 0;
        $score += $venue->reservation_route === $data['route'] ? 40 : 0;
        $score += $venue->show_on_landing ? 20 : 0;
        $score += $venue->image ? 10 : 0;
        $score -= (int) $venue->id;

        return $score;
    }

    private function metadata(object $venue): array
    {
        $metadata = json_decode($venue->metadata ?? '[]', true);

        return is_array($metadata) ? $metadata : [];
    }
};
