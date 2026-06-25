<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #F7F4EE; color: #18140E; padding: 20px; }
        .card { background-color: #FFFFFF; border: 1px solid rgba(140,107,42,0.12); border-radius: 12px; padding: 30px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 12px rgba(44,36,24,0.03); }
        h2 { color: #8C6B2A; font-size: 20px; font-weight: 700; margin-top: 0; }
        .code { font-size: 28px; font-weight: 800; letter-spacing: 0.15em; color: #8C6B2A; background-color: #FAF8F4; border: 1px dashed rgba(140,107,42,0.22); padding: 12px; border-radius: 8px; text-align: center; margin: 24px 0; }
        p { font-size: 14px; line-height: 1.6; color: #5E5548; }
        .footer { font-size: 11px; color: #9C9283; margin-top: 30px; text-align: center; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 15px; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Confirm Your Email Change</h2>
        <p>Hi {{ $adminName }},</p>
        <p>A request was made to update the email address for your account on the Bellevue Seat & Table Reservation System. Please use the verification code below to verify ownership of this email inbox:</p>
        <div class="code">{{ $code }}</div>
        <p>This code is valid for 15 minutes. If you did not make this request, please log in and change your password immediately as your login credentials may be compromised.</p>
        <div class="footer">
            © The Bellevue Manila Reservation System.
        </div>
    </div>
</body>
</html>
