<?php

namespace App\Services;

use App\Models\SeatMap;
use App\Models\Venue;

class SeatMapService
{
    /**
     * Get the live published layout for guest pages.
     */
    public function getLiveLayout(int $venueId): ?SeatMap
    {
        return SeatMap::where('venue_id', $venueId)
            ->where('status', 'published')
            ->orderByDesc('version_number')
            ->first();
    }

    /**
     * Get the layout for admin editor (Draft if exists, otherwise Published).
     * Safety: if the draft is empty but a published layout has data, return published instead.
     */
    public function getAdminLayout(int $venueId): ?SeatMap
    {
        $draft = SeatMap::where('venue_id', $venueId)
            ->where('status', 'draft')
            ->first();

        if ($draft) {
            // Safety check: if draft has no tables and no standaloneSeats,
            // but a published layout exists with data, skip the empty draft
            $draftPayload = $draft->payload;
            $draftTables = $draftPayload['tables'] ?? [];
            $draftSeats = $draftPayload['standaloneSeats'] ?? [];
            
            if (empty($draftTables) && empty($draftSeats)) {
                $published = $this->getLiveLayout($venueId);
                if ($published) {
                    $pubPayload = $published->payload;
                    $pubTables = $pubPayload['tables'] ?? [];
                    $pubSeats = $pubPayload['standaloneSeats'] ?? [];
                    
                    if (!empty($pubTables) || !empty($pubSeats)) {
                        // Published has data but draft is empty — delete the bad draft, return published
                        $draft->delete();
                        return $published;
                    }
                }
            }
            
            return $draft;
        }

        return $this->getLiveLayout($venueId);
    }

    /**
     * Save a draft version.
     * Safety: reject empty payloads when a published layout with data exists.
     */
    public function saveDraft(int $venueId, array $payload, ?int $adminId = null): SeatMap|false
    {
        $tables = $payload['tables'] ?? [];
        $seats = $payload['standaloneSeats'] ?? [];
        
        // Reject empty saves when a published layout with data exists
        if (empty($tables) && empty($seats)) {
            $published = $this->getLiveLayout($venueId);
            if ($published) {
                $pubPayload = $published->payload;
                $pubTables = $pubPayload['tables'] ?? [];
                $pubSeats = $pubPayload['standaloneSeats'] ?? [];
                if (!empty($pubTables) || !empty($pubSeats)) {
                    // Don't overwrite a good published layout with an empty draft
                    return false;
                }
            }
        }

        $draft = SeatMap::where('venue_id', $venueId)
            ->where('status', 'draft')
            ->first();

        if ($draft) {
            $draft->update([
                'payload' => $payload,
            ]);
            return $draft;
        }

        return SeatMap::create([
            'venue_id' => $venueId,
            'status' => 'draft',
            'payload' => $payload,
            'version_number' => 0, // drafts don't get version numbers until published
            'created_by' => $adminId,
        ]);
    }

    /**
     * Publish the current draft to live.
     */
    public function publishDraft(int $venueId, ?int $adminId = null): ?SeatMap
    {
        $draft = SeatMap::where('venue_id', $venueId)
            ->where('status', 'draft')
            ->first();

        if (!$draft) {
            // Nothing to publish
            return null;
        }

        // Archive currently published map
        $currentPublished = $this->getLiveLayout($venueId);
        $newVersion = 1;

        if ($currentPublished) {
            $currentPublished->update(['status' => 'archived']);
            $newVersion = $currentPublished->version_number + 1;
        }

        // Duplicate the draft into a new published record
        $published = SeatMap::create([
            'venue_id' => $venueId,
            'status' => 'published',
            'payload' => $draft->payload,
            'version_number' => $newVersion,
            'created_by' => $draft->created_by,
            'published_by' => $adminId,
            'published_at' => now(),
        ]);

        // Delete the draft now that it is published
        $draft->delete();

        return $published;
    }
}
