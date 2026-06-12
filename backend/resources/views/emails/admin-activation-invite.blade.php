<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Activate Your Account - The Bellevue Manila</title>
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
            font-size: 22px;
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
            margin-bottom: 25px;
        }

        .cta-container {
            text-align: center;
            margin: 30px 0;
        }

        .cta-button {
            display: inline-block;
            background-color: #8C6B2A;
            color: #FFFFFF !important;
            text-decoration: none;
            padding: 12px 35px;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            border-radius: 4px;
            box-shadow: 0 4px 10px rgba(140,107,42,0.2);
            transition: background 0.2s ease;
        }

        .account-details {
            background: #FAFAFA;
            border: 1px solid #EEEEEE;
            border-radius: 8px;
            padding: 18px 20px;
            margin: 25px 0;
        }

        .details-title {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #8C6B2A;
            margin-bottom: 12px;
            font-weight: 700;
        }

        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 13.5px;
        }

        .detail-row:last-child {
            margin-bottom: 0;
        }

        .detail-label {
            color: #777777;
        }

        .detail-value {
            color: #1A1A1A;
            font-weight: 600;
        }

        .expiry-note {
            font-size: 12px;
            color: #999999;
            text-align: center;
            margin-top: 15px;
            font-style: italic;
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
            <h1 class="header-title">{{ $isReset ? 'Password Reset' : 'Staff Invitation' }}</h1>
        </div>

        {{-- Content --}}
        <div class="content">

            <p class="greeting">Dear <strong>{{ $admin->name }},</strong></p>

            <p class="message-text">
                @if($isReset)
                    We received a request to reset the password for your administrative account on the <strong>The Bellevue Manila Reservation System</strong>. 
                    Please set up a new password to regain access to your dashboard.
                @else
                    An administrator has created a staff account for you on the <strong>The Bellevue Manila Reservation System</strong>. 
                    Before you can log in, you must activate your account and set up your private password.
                @endif
            </p>

            @if(!$isReset)
            <div class="account-details">
                <div class="details-title">Account Details</div>
                <div class="detail-row">
                    <span class="detail-label">Username:</span>
                    <span class="detail-value">{{ $admin->username }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Email:</span>
                    <span class="detail-value">{{ $admin->email }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Assigned Role:</span>
                    <span class="detail-value">{{ strtoupper(str_replace('_', ' ', $admin->role)) }}</span>
                </div>
            </div>
            @endif

            <div class="cta-container">
                <a href="{{ $activationUrl }}" class="cta-button">{{ $isReset ? 'Reset Password' : 'Activate Account' }}</a>
                <p class="expiry-note">This link is valid for {{ $isReset ? '2 hours' : '48 hours' }}.</p>
            </div>

            <p class="message-text" style="font-size: 13px; color: #888; margin-top: 30px;">
                If you did not expect this request, please ignore this email or contact support.
            </p>

        </div>

        {{-- Footer --}}
        <div class="footer">
            <div class="footer-address">
                The Bellevue Manila<br>
                North Bridgeway, Filinvest City, Alabang, Muntinlupa<br>
                For inquiries, please contact our administrative desk.
            </div>
            <div class="footer-copyright">
                &copy; {{ date('Y') }} The Bellevue Manila. All rights reserved.
            </div>
        </div>

    </div>
</body>
</html>
