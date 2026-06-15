<?php

namespace App\Http\Controllers;

use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EventController extends Controller
{
    public function index(Request $request)
    {
        $query = Event::with('venue');

        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }

        return response()->json([
            'status' => 'success',
            'data' => $query->latest()->get()
        ]);
    }

    public function show($slug)
    {
        $event = Event::with('venue')->where('slug', $slug)->firstOrFail();

        return response()->json([
            'status' => 'success',
            'data' => $event
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'venue_id' => 'required|exists:venues,id',
            'slug' => 'required|string|unique:events,slug|max:255',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'banner_image' => 'nullable|string',
            'start_datetime' => 'required|date',
            'end_datetime' => 'required|date|after:start_datetime',
            'status' => ['required', Rule::in(['draft', 'published', 'cancelled'])],
            'metadata' => 'nullable|array',
        ]);

        $event = Event::create($validated);

        return response()->json([
            'status' => 'success',
            'data' => $event->load('venue'),
            'message' => 'Event created successfully.'
        ], 201);
    }

    public function update(Request $request, Event $event)
    {
        $validated = $request->validate([
            'venue_id' => 'sometimes|exists:venues,id',
            'slug' => ['sometimes', 'string', 'max:255', Rule::unique('events')->ignore($event->id)],
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'banner_image' => 'nullable|string',
            'start_datetime' => 'sometimes|date',
            'end_datetime' => 'sometimes|date|after:start_datetime',
            'status' => ['sometimes', Rule::in(['draft', 'published', 'cancelled'])],
            'metadata' => 'nullable|array',
        ]);

        $event->update($validated);

        return response()->json([
            'status' => 'success',
            'data' => $event->load('venue'),
            'message' => 'Event updated successfully.'
        ]);
    }

    public function destroy(Event $event)
    {
        $event->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Event deleted successfully.'
        ]);
    }

    public function uploadImage(Request $request, Event $event)
    {
        $request->validate([
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        $directory = public_path('images/events');
        if (!\Illuminate\Support\Facades\File::exists($directory)) {
            \Illuminate\Support\Facades\File::makeDirectory($directory, 0755, true);
        }

        $file = $request->file('image');
        $filename = uniqid('evt_') . '.' . $file->getClientOriginalExtension();
        $file->move($directory, $filename);

        $event->update([
            'banner_image' => '/images/events/' . $filename
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $event->load('venue'),
            'message' => 'Image uploaded successfully.'
        ]);
    }
}
