<?php

namespace App\Http\Controllers;

use App\Models\ClientDisplaySetting;
use Illuminate\Http\Request;

class ClientDisplaySettingController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return response()->json(ClientDisplaySetting::all());
    }

    /**
     * Update the specified resource in storage.
     */
    public function updateSection(Request $request, string $section)
    {
        $validated = $request->validate([
            'desktop_columns' => 'nullable|integer|min:1|max:12',
            'tablet_columns' => 'nullable|integer|min:1|max:12',
            'mobile_columns' => 'nullable|integer|min:1|max:12',
            'visible_rows' => 'nullable|integer|min:1',
            'card_size' => 'nullable|string|in:compact,standard,feature',
            'ordered_ids' => 'nullable|array',
            'hidden_ids' => 'nullable|array',
        ]);

        $setting = ClientDisplaySetting::firstOrCreate(
            ['section' => $section]
        );

        $setting->update($validated);

        return response()->json($setting);
    }
}
