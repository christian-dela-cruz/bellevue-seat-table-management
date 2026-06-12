<?php

namespace App\Mail;

use App\Models\Admin;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class AdminActivationInviteMail extends Mailable
{
    use Queueable, SerializesModels;

    public Admin $admin;
    public string $activationUrl;
    public bool $isReset;

    /**
     * Create a new message instance.
     */
    public function __construct(Admin $admin, bool $isReset = false)
    {
        $this->admin = $admin;
        $this->isReset = $isReset;
        $frontendUrl = rtrim(env('FRONTEND_URL', 'http://localhost:5173'), '/');
        $this->activationUrl = $frontendUrl . '/activate/' . $admin->activation_token . ($isReset ? '?reset=1' : '');
    }

    public function build(): static
    {
        $subject = $this->isReset 
            ? 'Reset Your Password – The Bellevue Manila' 
            : 'Activate Your Account – The Bellevue Manila';

        return $this
            ->subject($subject)
            ->view('emails.admin-activation-invite')
            ->with([
                'admin' => $this->admin,
                'activationUrl' => $this->activationUrl,
                'isReset' => $this->isReset,
            ]);
    }
}
