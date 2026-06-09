<?php

namespace App\Http\Requests\Venue;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class VenueStoreRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isDraft = $this->input('is_draft', false);

        return [
            'parent_id' => 'nullable|exists:venues,id',
            'name' => 'required|string|max:255',
            'slug' => ['nullable', 'string', 'max:255', Rule::unique('venues', 'slug')->where('is_archived', false)],
            'display_name' => 'nullable|string|max:255',
            'wing' => $isDraft ? 'nullable|string|max:255' : 'required|string|max:255',
            'type' => $isDraft ? 'nullable|string|max:255' : 'required|string|max:255',
            'category' => 'nullable|string|max:255',
            'capacity' => 'nullable|integer|min:0',
            'price_per_hour' => 'nullable|numeric|min:0',
            'description' => 'nullable|string',
            'image' => 'nullable|string',
            'display_order' => $isDraft ? 'nullable|integer|min:0' : 'required|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'is_visible' => 'sometimes|boolean',
            'show_on_landing' => 'sometimes|boolean',
            'reservations_enabled' => 'sometimes|boolean',
            'parent_selectable' => 'sometimes|boolean',
            'child_selectable' => 'sometimes|boolean',
            'reservation_route' => ['nullable', 'string', 'max:255', 'regex:/^\//'],
            'image_position' => 'nullable|string|max:255',
            'metadata' => 'nullable|array',
            'is_draft' => 'sometimes|boolean',
        ];
    }
}
