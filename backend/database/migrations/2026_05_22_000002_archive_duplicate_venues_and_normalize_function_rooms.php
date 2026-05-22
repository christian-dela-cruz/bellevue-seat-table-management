<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $parentNames = [
        'Alabang Function Room',
        'Laguna Ballroom',
        '20/20 Function Room',
        'Grand Ballroom',
        'Tower Ballroom',
        'Business Center',
    ];

    private array $childParentMap = [
        'laguna ballroom 1' => 'laguna ballroom',
        'laguna ballroom 2' => 'laguna ballroom',
        'laguna 1' => 'laguna ballroom',
        'laguna 2' => 'laguna ballroom',
        '20/20 function room a' => '20/20 function room',
        '20/20 function room b' => '20/20 function room',
        '20/20 function room c' => '20/20 function room',
        '2020 function room a' => '20/20 function room',
        '2020 function room b' => '20/20 function room',
        '2020 function room c' => '20/20 function room',
        'grand ballroom a' => 'grand ballroom',
        'grand ballroom b' => 'grand ballroom',
        'grand ballroom c' => 'grand ballroom',
        'tower 1' => 'tower ballroom',
        'tower 2' => 'tower ballroom',
        'tower 3' => 'tower ballroom',
    ];

    public function up(): void
    {
        if (!Schema::hasTable('venues')) {
            return;
        }

        $needsArchived = !Schema::hasColumn('venues', 'is_archived');
        $needsArchivedAt = !Schema::hasColumn('venues', 'archived_at');

        if ($needsArchived || $needsArchivedAt) {
            Schema::table('venues', function (Blueprint $table) use ($needsArchived, $needsArchivedAt) {
                if ($needsArchived) {
                    $table->boolean('is_archived')->default(false)->after('is_active');
                }

                if ($needsArchivedAt) {
                    $table->timestamp('archived_at')->nullable()->after('is_archived');
                }
            });
        }

        $this->normalizeFunctionRoomHierarchy();
        $this->archiveDuplicateFunctionRooms();
    }

    public function down(): void
    {
        if (!Schema::hasTable('venues')) {
            return;
        }

        $hasArchived = Schema::hasColumn('venues', 'is_archived');
        $hasArchivedAt = Schema::hasColumn('venues', 'archived_at');

        if (!$hasArchived && !$hasArchivedAt) {
            return;
        }

        Schema::table('venues', function (Blueprint $table) use ($hasArchived, $hasArchivedAt) {
            if ($hasArchivedAt) {
                $table->dropColumn('archived_at');
            }

            if ($hasArchived) {
                $table->dropColumn('is_archived');
            }
        });
    }

    private function normalizeFunctionRoomHierarchy(): void
    {
        $venues = $this->functionRooms();
        $parents = $this->canonicalParents($venues);

        foreach ($venues as $venue) {
            $name = $this->canonicalName($venue->name);
            $displayName = $this->canonicalName($venue->display_name);
            $parentName = $this->childParentMap[$name] ?? $this->childParentMap[$displayName] ?? null;
            $parent = $parentName ? ($parents[$parentName] ?? null) : null;

            if (!$parent || (int) $parent->id === (int) $venue->id) {
                continue;
            }

            DB::table('venues')
                ->where('id', $venue->id)
                ->update([
                    'parent_id' => $parent->id,
                    'show_on_landing' => false,
                    'parent_selectable' => false,
                    'updated_at' => Carbon::now(),
                ]);
        }
    }

    private function archiveDuplicateFunctionRooms(): void
    {
        $venues = $this->functionRooms();
        $parents = $this->canonicalParents($venues);
        $groups = [];

        foreach ($venues as $venue) {
            $key = $this->groupKey($venue, $parents);
            if (!$key) {
                continue;
            }

            $groups[$key][] = $venue;
        }

        foreach ($groups as $group) {
            if (count($group) < 2) {
                continue;
            }

            usort($group, fn ($a, $b) => $this->scoreVenue($b) <=> $this->scoreVenue($a));
            $canonical = array_shift($group);

            foreach ($group as $duplicate) {
                $this->archiveDuplicate($duplicate, $canonical);
            }
        }

        DB::table('venues')
            ->where('type', 'function_room')
            ->whereNotNull('parent_id')
            ->update([
                'show_on_landing' => false,
                'parent_selectable' => false,
                'updated_at' => Carbon::now(),
            ]);

        DB::table('venues')
            ->where('type', 'function_room')
            ->where('is_archived', true)
            ->update([
                'is_active' => false,
                'is_visible' => false,
                'show_on_landing' => false,
                'reservations_enabled' => false,
                'updated_at' => Carbon::now(),
            ]);
    }

    private function archiveDuplicate(object $duplicate, object $canonical): void
    {
        if ((int) $duplicate->id === (int) $canonical->id) {
            return;
        }

        DB::table('reservations')
            ->where('venue_id', $duplicate->id)
            ->update(['venue_id' => $canonical->id]);

        DB::table('seats')
            ->where('venue_id', $duplicate->id)
            ->update(['venue_id' => $canonical->id]);

        DB::table('venues')
            ->where('parent_id', $duplicate->id)
            ->update([
                'parent_id' => $canonical->id,
                'show_on_landing' => false,
                'updated_at' => Carbon::now(),
            ]);

        $metadata = $this->metadata($duplicate);
        $metadata['archived_reason'] = 'Duplicate function room normalized during FES-010 cleanup.';
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

    private function functionRooms()
    {
        return DB::table('venues')
            ->where('type', 'function_room')
            ->where(function ($query) {
                $query->where('is_archived', false)->orWhereNull('is_archived');
            })
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();
    }

    private function canonicalParents($venues): array
    {
        $parents = [];

        foreach ($this->parentNames as $name) {
            $key = $this->canonicalName($name);
            $matches = $venues
                ->filter(fn ($venue) => $this->canonicalName($venue->name) === $key || $this->canonicalName($venue->display_name) === $key)
                ->values()
                ->all();

            if (!$matches) {
                continue;
            }

            usort($matches, fn ($a, $b) => $this->scoreVenue($b) <=> $this->scoreVenue($a));
            $parents[$key] = $matches[0];
        }

        return $parents;
    }

    private function groupKey(object $venue, array $parents): ?string
    {
        $name = $this->canonicalName($venue->name);
        $displayName = $this->canonicalName($venue->display_name);
        $parentName = $this->childParentMap[$name] ?? $this->childParentMap[$displayName] ?? null;

        if ($parentName && isset($parents[$parentName])) {
            return 'child:' . $parents[$parentName]->id . ':' . $this->childKey($name, $displayName, $parentName);
        }

        if ($venue->parent_id) {
            return 'child:' . $venue->parent_id . ':' . ($displayName ?: $name ?: $venue->slug);
        }

        $parentKey = $this->canonicalParentName($name ?: $displayName);
        if ($parentKey) {
            return 'parent:' . $parentKey;
        }

        return 'standalone:' . ($venue->slug ?: $name ?: $venue->id);
    }

    private function childKey(string $name, string $displayName, string $parentName): string
    {
        $value = $displayName ?: $name;
        $value = trim(str_replace($parentName, '', $value));
        $value = str_replace(['function room', 'ballroom'], '', $value);

        return trim($value) ?: $name;
    }

    private function canonicalParentName(string $value): ?string
    {
        foreach ($this->parentNames as $name) {
            $key = $this->canonicalName($name);
            if ($value === $key) {
                return $key;
            }
        }

        return null;
    }

    private function scoreVenue(object $venue): int
    {
        $score = 0;
        $knownSlug = in_array($venue->slug, [
            'alabang-function-room',
            'laguna-ballroom',
            '20-20-function-room',
            'grand-ballroom',
            'tower-ballroom',
            'business-center',
            'laguna-ballroom-1',
            'laguna-ballroom-2',
            '20-20-function-room-a',
            '20-20-function-room-b',
            '20-20-function-room-c',
            'grand-ballroom-a',
            'grand-ballroom-b',
            'grand-ballroom-c',
            'tower-1',
            'tower-2',
            'tower-3',
        ], true);

        $score += $knownSlug ? 1000 : 0;
        $score += $venue->slug ? 80 : 0;
        $score += $venue->reservation_route ? 40 : 0;
        $score += $venue->show_on_landing ? 20 : 0;
        $score += $venue->image ? 10 : 0;
        $score -= (int) ($venue->display_order ?? 0);
        $score -= (int) $venue->id;

        return $score;
    }

    private function canonicalName(?string $value): string
    {
        $value = strtolower((string) $value);
        $value = preg_replace('/\s+/', ' ', $value);
        $value = preg_replace('/[^a-z0-9\/ ]/', '', $value);

        return trim($value ?? '');
    }

    private function metadata(object $venue): array
    {
        $metadata = json_decode($venue->metadata ?? '[]', true);

        return is_array($metadata) ? $metadata : [];
    }
};
