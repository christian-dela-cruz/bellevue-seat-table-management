# ── Environment Files ──────────────────────────────────────────────────────────
# This directory contains environment configuration files

## Files Overview:

### Backend Environment Files:
- `.env` - Development environment variables
- `.env.production` - Production environment variables
- `.env.example` - Template file with all available options

### Frontend Environment Files:
- `.env` - Development environment variables
- `.env.production` - Production environment variables

## Setup Instructions:

### 1. Backend Setup:
```bash
# Copy the example file to create your environment
cp .env.example .env

# Generate application key
php artisan key:generate

# Update database and other settings in .env
```

### 2. Frontend Setup:
```bash
# The .env file is already configured for development
# Update VITE_API_BASE_URL if your backend runs on different port
```

### 3. Production Deployment:
```bash
# Backend: Copy .env.production to .env and update production values
# Frontend: The .env.production file will be used automatically in production build
```

## Key Environment Variables:

### Backend:
- `APP_URL` - Backend application URL
- `DB_CONNECTION` - Database connection type
- `CORS_ALLOWED_ORIGINS` - Allowed frontend URLs

### Frontend:
- `VITE_API_BASE_URL` - Backend API endpoint
- `VITE_APP_URL` - Frontend application URL
- `VITE_*_FLAGS` - Feature toggles

## Security Notes:
- Never commit `.env` files to version control
- Use strong, unique APP_KEY in production
- Update database credentials for production
- Configure proper CORS origins for security
