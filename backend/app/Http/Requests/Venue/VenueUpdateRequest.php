<?php

namespace App\Http\Requests\Venue;

use Illuminate\Foundation\Http\FormRequest;

class VenueUpdateRequest extends FormRequest
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
        return [
            'name' => 'sometimes|required|string|max:255',
            'wing' => 'sometimes|required|string|max:255',
            'type' => 'sometimes|required|string|max:255',
            'capacity' => 'sometimes|required|integer|min:0',
            'price_per_hour' => 'sometimes|nullable|numeric|min:0',
            'pricing_mode' => 'sometimes|nullable|string|in:fixed,per_person,per_seat,package,custom',
            'base_price' => 'sometimes|nullable|numeric|min:0',
            'price_per_person' => 'sometimes|nullable|numeric|min:0',
            'price_per_seat' => 'sometimes|nullable|numeric|min:0',
            'show_price_to_guest_default' => 'sometimes|boolean',
            'description' => 'sometimes|nullable|string',
            'image' => 'sometimes|nullable|string',
            'is_active' => 'sometimes|boolean',
        ];
    }
}
