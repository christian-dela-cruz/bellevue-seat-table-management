<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Seat;
use App\Models\Venue;

class SeatSeeder extends Seeder
{
    public function run(): void
    {
        // Get all venues
        $venues = Venue::all();
        
        foreach ($venues as $venue) {
            // Create seats for each venue based on its type and capacity
            $this->createSeatsForVenue($venue);
        }
    }
    
    private function createSeatsForVenue(Venue $venue): void
    {
        $seats = [];
        
        // Define seat layouts for different venue types
        switch ($venue->name) {
            case 'Alabang Function Room':
                $seats = $this->createAlabangFunctionRoomSeats();
                break;
            case 'Laguna Ballroom':
                $seats = $this->createLagunaBallroomSeats();
                break;
            case '20/20 Function Room':
                $seats = $this->create2020FunctionRoomSeats();
                break;
            case 'Business Center':
                $seats = $this->createBusinessCenterSeats();
                break;
            case 'Tower Ballroom':
                $seats = $this->createTowerBallroomSeats();
                break;
            default:
                $seats = $this->createDefaultSeats($venue->capacity);
        }
        
        // Insert seats into database
        foreach ($seats as $seat) {
            Seat::create([
                'venue_id' => $venue->id,
                'table_number' => $seat['table_number'],
                'seat_number' => $seat['seat_number'],
                'x_position' => $seat['x_position'],
                'y_position' => $seat['y_position'],
                'status' => 'available',
            ]);
        }
    }
    
    private function createAlabangFunctionRoomSeats(): array
    {
        $seats = [];
        
        // Table T1 to T4 (8 seats each)
        for ($table = 1; $table <= 4; $table++) {
            for ($i = 1; $i <= 8; $i++) {
                $seats[] = [
                    'table_number' => "T$table",
                    'seat_number' => "Seat $i",
                    'x_position' => 100 + ($i - 1) * 40,
                    'y_position' => 100 * $table,
                ];
            }
        }
        
        return $seats;
    }
    
    private function createLagunaBallroomSeats(): array
    {
        $seats = [];
        
        // Create 4 tables (T1-T4) for the larger ballroom
        for ($table = 1; $table <= 4; $table++) {
            for ($seat = 1; $seat <= 10; $seat++) {
                $seats[] = [
                    'table_number' => "T$table",
                    'seat_number' => "Seat $seat",
                    'x_position' => 50 + ($table - 1) * 120,
                    'y_position' => 50 + ($seat - 1) * 30,
                ];
            }
        }
        
        return $seats;
    }
    
    private function create2020FunctionRoomSeats(): array
    {
        $seats = [];
        
        // Tables T1 to T4 (6 seats each)
        for ($table = 1; $table <= 4; $table++) {
            for ($i = 1; $i <= 6; $i++) {
                $seats[] = [
                    'table_number' => "T$table",
                    'seat_number' => "Seat $i",
                    'x_position' => 80 + ($table - 1) * 150,
                    'y_position' => 80 + ($i - 1) * 35,
                ];
            }
        }
        
        return $seats;
    }
    
    private function createBusinessCenterSeats(): array
    {
        $seats = [];
        
        // Business Center has 4 tables (T1-T4)
        for ($table = 1; $table <= 4; $table++) {
            for ($seat = 1; $seat <= 4; $seat++) {
                $seats[] = [
                    'table_number' => "T$table",
                    'seat_number' => "Seat $seat",
                    'x_position' => 100 + ($table - 1) * 100,
                    'y_position' => 100 + ($seat - 1) * 40,
                ];
            }
        }
        
        return $seats;
    }
    
    private function createTowerBallroomSeats(): array
    {
        $seats = [];
        
        // Large ballroom with 4 tables (T1-T4)
        for ($table = 1; $table <= 4; $table++) {
            for ($seat = 1; $seat <= 12; $seat++) {
                $seats[] = [
                    'table_number' => "T$table",
                    'seat_number' => "Seat $seat",
                    'x_position' => 50 + (($table - 1) % 4) * 150,
                    'y_position' => 50 + floor(($table - 1) / 4) * 200 + ($seat - 1) * 25,
                ];
            }
        }
        
        return $seats;
    }
    
    private function createDefaultSeats(int $capacity): array
    {
        $seats = [];
        $tablesNeeded = 4; // Exactly 4 tables
        
        for ($table = 1; $table <= $tablesNeeded; $table++) {
            $seatsInTable = 8; // 8 seats per table
            
            for ($seat = 1; $seat <= $seatsInTable; $seat++) {
                $seats[] = [
                    'table_number' => "T$table",
                    'seat_number' => "Seat $seat",
                    'x_position' => 100 + ($table - 1) * 120,
                    'y_position' => 100 + ($seat - 1) * 35,
                ];
            }
        }
        
        return $seats;
    }
}
