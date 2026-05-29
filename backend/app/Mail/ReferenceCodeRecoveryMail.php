<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

class ReferenceCodeRecoveryMail extends Mailable
{
    use Queueable, SerializesModels;

    public Collection $reservations;

    /**
     * Create a new message instance.
     *
     * @param  Collection  $reservations  Active reservations for the given email
     */
    public function __construct(Collection $reservations)
    {
        $this->reservations = $reservations;
    }

    public function build(): static
    {
        return $this
            ->subject('Your Reservation Reference Code(s) – The Bellevue Manila')
            ->view('emails.reference-code-recovery')
            ->with([
                'reservations' => $this->reservations,
            ]);
    }
}
