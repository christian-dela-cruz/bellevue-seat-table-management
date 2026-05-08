<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ReservationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminReportController extends Controller
{
    public function __construct(private ReservationService $reservationService)
    {
    }

    public function outletReports(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
        ]);

        return response()->json(
            $this->reservationService->getOutletReports(
                $request->attributes->get('admin'),
                $validated['start_date'] ?? null,
                $validated['end_date'] ?? null,
            )
        );
    }
}
