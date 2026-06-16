<?php

namespace App\Console\Commands;

use App\Models\Reservation;
use App\Models\ReservationTransaction;
use App\Mail\ReservationReminderMail;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class SendReservationReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'reservations:send-reminders';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send email reminders to clients whose reservations are scheduled for today';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $today = Carbon::today()->format('Y-m-d');
        $this->info("Checking for reservations scheduled for today: {$today}...");

        // Fetch reservations scheduled for today with confirmed status
        $reservations = Reservation::whereDate('event_date', $today)
            ->whereIn('status', ['approved', 'reserved'])
            ->get();

        if ($reservations->isEmpty()) {
            $this->info('No reservations scheduled for today.');
            return Command::SUCCESS;
        }

        $sentCount = 0;
        $skippedCount = 0;

        foreach ($reservations as $reservation) {
            // Check if reminder was already sent today
            $alreadySent = ReservationTransaction::where('reservation_id', $reservation->id)
                ->where('action', 'reminder_sent')
                ->whereDate('created_at', Carbon::today())
                ->exists();

            if ($alreadySent) {
                $this->info("Skipped: Reminder already sent today for reservation {$reservation->reference_code} ({$reservation->email}).");
                $skippedCount++;
                continue;
            }

            try {
                // Send the email reminder
                Mail::to($reservation->email)
                    ->send(new ReservationReminderMail($reservation));

                // Record transaction
                ReservationTransaction::create([
                    'reservation_id' => $reservation->id,
                    'action' => 'reminder_sent',
                    'from_status' => $reservation->status,
                    'to_status' => $reservation->status,
                    'notes' => 'Day-of reservation reminder email sent to guest.',
                    'metadata' => [
                        'channel' => 'email',
                        'type' => 'reservation_reminder'
                    ],
                ]);

                $this->info("Sent: Reminder email sent to {$reservation->email} for reservation {$reservation->reference_code}.");
                $sentCount++;
            } catch (\Exception $e) {
                $this->error("Failed to send reminder to {$reservation->email} for reservation {$reservation->reference_code}: {$e->getMessage()}");
                Log::error("Failed to send reservation reminder email: " . $e->getMessage(), [
                    'reservation_id' => $reservation->id,
                    'reference_code' => $reservation->reference_code,
                    'email' => $reservation->email
                ]);
            }
        }

        $this->info("Completed. Sent: {$sentCount}, Skipped: {$skippedCount}.");
        return Command::SUCCESS;
    }
}
