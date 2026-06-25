<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class AdminEmailChangeVerificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public $code;
    public $adminName;

    public function __construct(string $code, string $adminName)
    {
        $this->code = $code;
        $this->adminName = $adminName;
    }

    public function build(): static
    {
        return $this
            ->subject('Verification Code to Confirm Email Change')
            ->view('emails.email-change-verification')
            ->with([
                'code' => $this->code,
                'adminName' => $this->adminName,
            ]);
    }
}
