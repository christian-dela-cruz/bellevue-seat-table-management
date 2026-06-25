<?php

namespace App\Services;

class Google2FAService
{
    /**
     * Generate a random 16-character Base32 secret key.
     */
    public static function generateSecret(): string
    {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $secret = '';
        for ($i = 0; $i < 16; $i++) {
            $secret .= $chars[random_int(0, 31)];
        }
        return $secret;
    }

    /**
     * Generate the provisioning URL to construct the setup QR Code.
     */
    public static function getProvisioningUri(string $username, string $secret, string $issuer = 'Bellevue Seat & Table'): string
    {
        return 'otpauth://totp/' . rawurlencode($issuer . ':' . $username) . '?secret=' . $secret . '&issuer=' . rawurlencode($issuer);
    }

    /**
     * Verify a 6-digit TOTP verification code.
     */
    public static function verifyCode(string $secret, string $code, int $discrepancy = 1): bool
    {
        $currentTimeSlice = floor(time() / 30);
        
        // Remove spaces if entered by user
        $code = str_replace(' ', '', $code);
        
        for ($i = -$discrepancy; $i <= $discrepancy; $i++) {
            $calculatedCode = self::getCode($secret, $currentTimeSlice + $i);
            if ($calculatedCode === $code) {
                return true;
            }
        }
        return false;
    }

    /**
     * Generate code for a specific time slice.
     */
    private static function getCode(string $secret, int $timeSlice): string
    {
        $secretKey = self::base32Decode($secret);

        // Pack time slice to 64bit binary string
        $time = chr(0).chr(0).chr(0).chr(0).pack('N', $timeSlice);
        
        // Hash it with SHA1
        $hmac = hash_hmac('sha1', $time, $secretKey, true);
        
        // Truncate
        $offset = ord($hmac[19]) & 0xf;
        $hashPart = (ord($hmac[$offset]) & 0x7f) << 24
            | (ord($hmac[$offset + 1]) & 0xff) << 16
            | (ord($hmac[$offset + 2]) & 0xff) << 8
            | (ord($hmac[$offset + 3]) & 0xff);
            
        $otp = $hashPart % 1000000;
        return str_pad((string)$otp, 6, '0', STR_PAD_LEFT);
    }

    /**
     * Decode a base32 string.
     */
    private static function base32Decode(string $base32): string
    {
        $base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $base32charsFlipped = array_flip(str_split($base32chars));

        $base32 = strtoupper($base32);
        $base32 = str_replace('=', '', $base32);
        
        $output = '';
        $buffer = 0;
        $bitsLeft = 0;
        
        for ($i = 0, $len = strlen($base32); $i < $len; $i++) {
            if (!isset($base32charsFlipped[$base32[$i]])) {
                continue;
            }
            $val = $base32charsFlipped[$base32[$i]];
            $buffer = ($buffer << 5) | $val;
            $bitsLeft += 5;
            
            if ($bitsLeft >= 8) {
                $bitsLeft -= 8;
                $output .= chr(($buffer >> $bitsLeft) & 0xff);
            }
        }
        return $output;
    }
}
