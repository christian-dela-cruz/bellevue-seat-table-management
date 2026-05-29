<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reference Code Recovery - The Bellevue Manila</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background: #F4F4F4;
            color: #333333;
            line-height: 1.6;
            padding: 40px 20px;
            -webkit-font-smoothing: antialiased;
        }

        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #FFFFFF;
            border-top: 4px solid #8C6B2A;
            box-shadow: 0 10px 30px rgba(0,0,0,0.05);
            overflow: hidden;
        }

        /* ── Header ── */
        .header {
            background: #FFFFFF;
            padding: 40px 40px 20px;
            text-align: center;
            border-bottom: 1px solid #EEEEEE;
        }

        .logo {
            max-width: 140px;
            height: auto;
            margin-bottom: 20px;
            display: block;
            margin-left: auto;
            margin-right: auto;
        }

        .header-title {
            font-family: 'Didot', 'Bodoni MT', 'Times New Roman', serif;
            font-size: 24px;
            font-weight: 400;
            color: #1A1A1A;
            letter-spacing: 0.5px;
            margin: 0;
            text-transform: uppercase;
        }

        /* ── Body ── */
        .content {
            padding: 40px;
        }

        .greeting {
            font-size: 16px;
            color: #1A1A1A;
            margin-bottom: 20px;
            font-weight: 300;
        }

        .message-text {
            font-size: 15px;
            line-height: 1.8;
            color: #555555;
            margin-bottom: 30px;
        }

        /* ── Reservation card ── */
        .reservation-card {
            border: 1px solid #EEEEEE;
            background: #FFFFFF;
            margin-bottom: 20px;
            border-top: 3px solid #D0C3A1;
        }

        .reservation-card-body {
            padding: 25px;
        }

        .ref-label {
            font-size: 11px;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #8C6B2A;
            font-weight: 600;
            margin-bottom: 5px;
        }

        .ref-code {
            font-family: 'Didot', 'Bodoni MT', 'Times New Roman', serif;
            font-size: 26px;
            font-weight: 700;
            color: #1A1A1A;
            letter-spacing: 2px;
            margin-bottom: 20px;
            line-height: 1.2;
        }

        .detail-row {
            display: table;
            width: 100%;
            border-bottom: 1px solid #F9F9F9;
        }

        .detail-row:last-child {
            border-bottom: none;
        }

        .detail-label {
            display: table-cell;
            font-size: 13px;
            color: #777777;
            padding: 10px 0;
            width: 35%;
        }

        .detail-value {
            display: table-cell;
            font-size: 13px;
            color: #1A1A1A;
            font-weight: 600;
            text-align: right;
            padding: 10px 0;
        }

        .status-badge {
            display: inline-block;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 1px;
            text-transform: uppercase;
            padding: 6px 15px;
            border-radius: 3px;
        }

        .status-pending {
            background: #FDF8ED;
            color: #8C6B2A;
            border: 1px solid #EBE1C7;
        }

        .status-approved,
        .status-reserved {
            background: #F0F8F3;
            color: #2E7A5A;
            border: 1px solid #D5EBE0;
        }

        .status-rejected {
            background: #FEF2F3;
            color: #B43232;
            border: 1px solid #FAD7D9;
        }

        .status-cancelled {
            background: #F9F9F9;
            color: #666666;
            border: 1px solid #DDDDDD;
        }

        .security-note {
            margin-top: 35px;
            padding: 20px;
            background: #FDF8ED;
            border-left: 3px solid #8C6B2A;
            font-size: 13px;
            color: #665533;
            line-height: 1.7;
        }

        .security-note strong {
            color: #8C6B2A;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 1px;
            display: block;
            margin-bottom: 5px;
        }

        /* ── Footer ── */
        .footer {
            background: #FAFAFA;
            border-top: 1px solid #EEEEEE;
            padding: 30px 40px;
            text-align: center;
        }

        .footer-address {
            font-size: 12px;
            color: #888888;
            line-height: 1.8;
            margin-bottom: 10px;
        }

        .footer-copyright {
            font-size: 11px;
            color: #BBBBBB;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        @media (max-width: 600px) {
            body { padding: 20px 10px; }
            .header, .content, .footer { padding: 30px 20px; }
            .reservation-card-body { padding: 20px 15px; }
            .ref-code { font-size: 22px; }
        }
    </style>
</head>
<body>
    <div class="email-container">

        {{-- Header --}}
        <div class="header">
            <img src="{{ asset('images/bellevue-logo.png') }}" alt="The Bellevue Manila" class="logo" onerror="this.style.display='none'">
            <h1 class="header-title">Reference Code Recovery</h1>
        </div>

        {{-- Content --}}
        <div class="content">

            <p class="greeting">Dear Guest,</p>

            <p class="message-text">
                We received a request to recover your reservation reference code(s). Below are your active reservations on file:
            </p>

            @foreach ($reservations as $reservation)
                <div class="reservation-card">
                    <div class="reservation-card-body">
                        <div class="ref-label">Reference Code</div>
                        <div class="ref-code">{{ $reservation->reference_code ?? 'N/A' }}</div>

                        <div class="detail-row">
                            <div class="detail-label">Guest</div>
                            <div class="detail-value">{{ $reservation->name ?? 'N/A' }}</div>
                        </div>
                        
                        <div class="detail-row">
                            <div class="detail-label">Venue</div>
                            <div class="detail-value">{{ $reservation->room ?? ($reservation->venue->name ?? 'N/A') }}</div>
                        </div>

                        <div class="detail-row">
                            <div class="detail-label">Date</div>
                            <div class="detail-value">
                                @if(!empty($reservation->event_date))
                                    {{ \Carbon\Carbon::parse($reservation->event_date)->format('F j, Y') }}
                                @else
                                    N/A
                                @endif
                            </div>
                        </div>

                        <div class="detail-row">
                            <div class="detail-label">Time</div>
                            <div class="detail-value">
                                @if(!empty($reservation->event_time))
                                    {{ \Carbon\Carbon::parse($reservation->event_time)->format('g:i A') }}
                                @else
                                    N/A
                                @endif
                            </div>
                        </div>

                        <div class="detail-row">
                            <div class="detail-label">Status</div>
                            <div class="detail-value">
                                @php
                                    $statusClass = match($reservation->status) {
                                        'pending' => 'status-pending',
                                        'approved', 'reserved' => 'status-approved',
                                        'rejected' => 'status-rejected',
                                        'cancelled' => 'status-cancelled',
                                        default => 'status-pending',
                                    };
                                    $statusLabel = match($reservation->status) {
                                        'pending' => 'Pending',
                                        'approved', 'reserved' => 'Confirmed',
                                        'rejected' => 'Rejected',
                                        'cancelled' => 'Cancelled',
                                        default => ucfirst($reservation->status),
                                    };
                                @endphp
                                <span class="status-badge {{ $statusClass }}">{{ $statusLabel }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            @endforeach

            <div class="security-note">
                <strong>Security Notice</strong>
                If you did not request this recovery, you can safely ignore this email. Your reservation details remain secure. Please do not share your reference code with anyone.
            </div>

        </div>

        {{-- Footer --}}
        <div class="footer">
            <div class="footer-address">
                The Bellevue Manila<br>
                North Bridgeway, Filinvest City, Alabang, Muntinlupa<br>
                For inquiries, please contact our reservations desk.
            </div>
            <div class="footer-copyright">
                &copy; {{ date('Y') }} The Bellevue Manila. All rights reserved.
            </div>
        </div>

    </div>
</body>
</html>
