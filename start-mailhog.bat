@echo off
echo Starting MailHog with persistent storage...

:: Create the data folder if it doesn't exist
if not exist "mailhog-data" mkdir "mailhog-data"

:: Start MailHog
.\MailHog.exe -storage maildir -maildir-path .\mailhog-data

pause
