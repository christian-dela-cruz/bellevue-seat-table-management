<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Reservation extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'reference_code',
        'name',
        'email',
        'phone',
        'venue_id',
        'event_id',
        'room',
        'table_number',
        'seat_number',
        'seat_id',
        'guests_count',
        'event_date',
        'event_time',
        'event_area',
        'setup_tables',
        'setup_chairs',
        'setup_requirements',
        'special_requests',
        'status',
        'reservation_state',
        'previous_status',
        'status_last_changed_at',
        'rejected_at',
        'reverted_at',
        'type',
        'is_standalone',
        'submitted_at',
        'rejection_reason',
        'cancellation_reason',
        'cancelled_at',
        'assigned_admin_id',
        'assigned_handler_name',
        'coordination_status',
        'internal_notes',
        'handoff_notes',
        'seen_by',
        'last_handled_by_id',
        'last_handled_by_name',
        'last_operational_action',
        'assigned_room_id',
        'public_room_name',
        'internal_room_name',
        'assignment_status',
        'consent_accepted',
        'pricing_mode',
        'base_price',
        'price_per_person',
        'price_per_seat',
        'package_name',
        'package_price',
        'calculated_price',
        'manual_price_override',
        'final_price',
        'price_notes',
        'show_price_to_guest',
        'pricing_updated_by',
        'pricing_updated_at',
    ];

    protected $casts = [
        'event_date'   => 'date:Y-m-d',   // ← fixed: was 'datetime', now serialises as YYYY-MM-DD
        'submitted_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'status_last_changed_at' => 'datetime',
        'rejected_at' => 'datetime',
        'reverted_at' => 'datetime',
        'is_standalone' => 'boolean',
        'seen_by' => 'array',
        'last_operational_at' => 'datetime',
        'show_price_to_guest' => 'boolean',
        'pricing_updated_at' => 'datetime',
        'base_price' => 'decimal:2',
        'price_per_person' => 'decimal:2',
        'price_per_seat' => 'decimal:2',
        'package_price' => 'decimal:2',
        'calculated_price' => 'decimal:2',
        'manual_price_override' => 'decimal:2',
        'final_price' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        static::saving(function (Reservation $reservation) {
            if ($reservation->isDirty('status') || blank($reservation->reservation_state)) {
                $reservation->reservation_state = self::stateForStatus($reservation->status);
            }

            // Pull default pricing settings from Venue if reservation is new and has no pricing mode set
            if (blank($reservation->pricing_mode) && filled($reservation->venue_id)) {
                $venue = $reservation->venue ?: \App\Models\Venue::find($reservation->venue_id);
                if ($venue && !blank($venue->pricing_mode)) {
                    $reservation->pricing_mode = $venue->pricing_mode;
                    $reservation->base_price = $venue->base_price;
                    $reservation->price_per_person = $venue->price_per_person;
                    $reservation->price_per_seat = $venue->price_per_seat;
                    $reservation->show_price_to_guest = $venue->show_price_to_guest_default;
                }
            }

            // Coerce non-nullable numeric fields to 0 if null/blank
            $reservation->base_price = $reservation->base_price ?: 0;
            $reservation->price_per_person = $reservation->price_per_person ?: 0;
            $reservation->price_per_seat = $reservation->price_per_seat ?: 0;
            $reservation->package_price = $reservation->package_price ?: 0;

            // Calculate calculated_price and final_price on saving
            if (!blank($reservation->pricing_mode)) {
                $guests = (int) ($reservation->guests_count ?: 1);
                
                // Estimate seat count: from database relationship or by parsing seat_number
                $seatCount = 0;
                if ($reservation->relationLoaded('seats') && $reservation->seats) {
                    $seatCount = $reservation->seats->count();
                }
                if ($seatCount === 0 && !blank($reservation->seat_number)) {
                    $seatCount = count(array_filter(explode(',', $reservation->seat_number)));
                }
                if ($seatCount === 0) {
                    $seatCount = $guests;
                }

                switch ($reservation->pricing_mode) {
                    case 'fixed':
                        $reservation->calculated_price = $reservation->base_price ?: 0;
                        break;
                    case 'per_person':
                        $reservation->calculated_price = ($reservation->price_per_person ?: 0) * $guests;
                        break;
                    case 'per_seat':
                        $reservation->calculated_price = ($reservation->price_per_seat ?: 0) * $seatCount;
                        break;
                    case 'package':
                        $reservation->calculated_price = $reservation->package_price ?: 0;
                        break;
                    case 'custom':
                        $reservation->calculated_price = $reservation->base_price ?: 0;
                        break;
                    default:
                        $reservation->calculated_price = 0;
                }
            } else {
                $reservation->calculated_price = 0;
            }

            $reservation->final_price = $reservation->manual_price_override !== null
                ? $reservation->manual_price_override
                : $reservation->calculated_price;

            if ($reservation->isDirty('status')) {
                $previousStatus = $reservation->getOriginal('status');
                $currentStatus = $reservation->status;

                if (filled($previousStatus) && $previousStatus !== $currentStatus) {
                    $reservation->previous_status = $previousStatus;
                    $reservation->status_last_changed_at = now();

                    if ($currentStatus === 'rejected' && blank($reservation->rejected_at)) {
                        $reservation->rejected_at = now();
                    }

                    if ($previousStatus === 'rejected' && $currentStatus === 'pending') {
                        $reservation->reverted_at = now();
                    }
                }
            }

            if (blank($reservation->status_last_changed_at)) {
                $reservation->status_last_changed_at = now();
            }
        });
    }

    public static function stateForStatus(?string $status): string
    {
        return in_array(strtolower((string) $status), ['rejected', 'cancelled'], true)
            ? 'inactive'
            : 'active';
    }

    public function venue(): BelongsTo
    {
        return $this->belongsTo(Venue::class);
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function assignedRoom(): BelongsTo
    {
        return $this->belongsTo(Venue::class, 'assigned_room_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(ReservationTransaction::class)->latest();
    }

    public function assignedAdmin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'assigned_admin_id');
    }

    public function lastHandledBy(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'last_handled_by_id');
    }

    public function seats(): HasMany
    {
        return $this->hasMany(Seat::class);
    }
}
