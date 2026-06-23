<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reservation Status - The Bellevue Manila</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
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
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
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

        .greeting strong {
            font-weight: 600;
        }

        .message-text {
            font-size: 15px;
            line-height: 1.8;
            color: #555555;
            margin-bottom: 20px;
        }

        .ref-code-box {
            background: #FAFAFA;
            border: 1px dashed #D0C3A1;
            padding: 15px 20px;
            text-align: center;
            margin: 25px 0;
        }

        .ref-code-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #8C6B2A;
            margin-bottom: 5px;
            font-weight: 600;
        }

        .ref-code {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1A1A1A;
            font-weight: 700;
            font-size: 24px;
            letter-spacing: 2px;
        }

        .details-box {
            margin-top: 30px;
            border-top: 1px solid #EEEEEE;
            padding-top: 25px;
        }

        .details-title {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #999999;
            margin-bottom: 15px;
            font-weight: 600;
        }

        .detail-row {
            display: table;
            width: 100%;
            margin-bottom: 10px;
        }

        .detail-label {
            display: table-cell;
            font-size: 14px;
            color: #777777;
            width: 35%;
            padding-bottom: 10px;
        }

        .detail-value {
            display: table-cell;
            font-size: 14px;
            color: #1A1A1A;
            font-weight: 600;
            padding-bottom: 10px;
        }

        /* ── Status badge ── */
        .status-wrap {
            text-align: center;
            margin-top: 35px;
            padding-top: 25px;
            border-top: 1px solid #EEEEEE;
        }

        .status-badge {
            display: inline-block;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            padding: 10px 30px;
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
        }
    </style>
</head>
<body>
    <div class="email-container">

        {{-- Header --}}
        <div class="header">
            <img src="{{ asset('images/bellevue-logo.png') }}" alt="The Bellevue Manila" class="logo" onerror="this.style.display='none'">
            <h1 class="header-title">Reservation Update</h1>
        </div>

        {{-- Content --}}
        <div class="content">

            <p class="greeting">Dear <strong>{{ $reservation->name ?? $name ?? 'Guest' }},</strong></p>

            {{-- Status message --}}
            <p class="message-text">
                @if($status === 'pending')
                    Your reservation has been received and is currently pending review. Our team will process your request shortly, and you will receive another email once a decision has been made. Thank you for your patience.
                @elseif($status === 'approved' || $status === 'reserved')
                    Great news! Your reservation has been approved and confirmed. Please arrive at least 15 minutes before your scheduled time. We look forward to welcoming you to The Bellevue Manila.
                @elseif($status === 'rejected')
                    We regret to inform you that we are unable to accommodate your reservation at this time.
                    @if(!empty($rejectionReason))
                        <br><br><strong>Reason:</strong> {{ $rejectionReason }}
                    @endif
                    <br><br>Thank you for your understanding.
                @elseif($status === 'cancelled')
                    Your reservation has been cancelled.
                    @if(!empty($rejectionReason))
                        <br><br><strong>Reason:</strong> {{ $rejectionReason }}
                    @endif
                    <br><br>If this was a mistake, please contact our reservations desk to rebook.
                @endif
            </p>

            @if(in_array($status, ['pending', 'approved', 'reserved', 'cancelled', 'rejected']))
            <div class="ref-code-box">
                <div class="ref-code-label">Reference Code</div>
                <div class="ref-code" style="margin-bottom: 12px;">{{ $reservation->reference_code ?? 'N/A' }}</div>
                <div class="status-badge status-{{ $status }}">
                    STATUS: 
                    @if($status === 'pending')
                        PENDING
                    @elseif($status === 'approved' || $status === 'reserved')
                        CONFIRMED
                    @elseif($status === 'rejected')
                        REJECTED
                    @elseif($status === 'cancelled')
                        CANCELLED
                    @else
                        {{ strtoupper($status) }}
                    @endif
                </div>
            </div>
            @endif

            {{-- Reservation Details --}}
            <div class="details-box">
                <div class="details-title">Reservation Details</div>

                <div class="detail-row">
                    <div class="detail-label">Guest Count</div>
                    <div class="detail-value">{{ $reservation->guests_count ?? $reservation->guests ?? 'N/A' }}</div>
                </div>

                <div class="detail-row">
                    <div class="detail-label">Venue</div>
                    <div class="detail-value">{{ $reservation->room ?? ($reservation->venue->name ?? ($reservation->venue ?? 'N/A')) }}</div>
                </div>

                @if(!empty($reservation->table_number) || !empty($reservation->table))
                <div class="detail-row">
                    <div class="detail-label">Seating</div>
                    <div class="detail-value">
                        Table {{ $reservation->table_number ?? $reservation->table ?? 'N/A' }}
                        @if(!empty($reservation->seat_number) || !empty($reservation->seat))
                            (Seat {{ $reservation->seat_number ?? $reservation->seat ?? 'N/A' }})
                        @endif
                    </div>
                </div>
                @endif

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

                @if(!empty($reservation->special_requests))
                <div class="detail-row">
                    <div class="detail-label">Special Requests</div>
                    <div class="detail-value" style="font-weight: 400;">{{ $reservation->special_requests }}</div>
                </div>
                @endif
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