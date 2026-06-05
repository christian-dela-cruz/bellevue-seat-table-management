<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Reservation extends Model
{
    protected $fillable = [
        'reference_code',
        'name',
        'email',
        'phone',
        'venue_id',
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
    ];

    protected static function booted(): void
    {
        static::saving(function (Reservation $reservation) {
            if ($reservation->isDirty('status') || blank($reservation->reservation_state)) {
                $reservation->reservation_state = self::stateForStatus($reservation->status);
            }

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
