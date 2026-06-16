<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ReservationReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    public $reservation;

    /**
     * Create a new message instance.
     *
     * @param  mixed  $reservation
     */
    public function __construct($reservation)
    {
        $this->reservation = $reservation;
    }

    public function build(): static
    {
        $subject = 'Reservation Reminder – Today is your schedule';

        return $this
            ->subject($subject)
            ->view('emails.reservation-reminder')
            ->with([
                'reservation' => $this->reservation,
            ]);
    }
}
