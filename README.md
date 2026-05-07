# Seat and Table Management System

Seat and Table Management System is a reservation management application for venue rooms, tables, and standalone seats. It has a React frontend for customers and administrators, plus a Laravel API backend for authentication, venues, reservations, seat maps, and reservation status workflows.

## Tech Stack

- Frontend: React 19, Vite, React Router, Lucide React, Framer Motion, GSAP
- Backend: Laravel 12, PHP 8.2+, Eloquent ORM
- Database: SQLite for local development, MySQL-compatible deployment possible with migration review
- Realtime helpers: Laravel broadcasting structure, Pusher-compatible frontend code, optional local `ws` websocket scripts
- API testing: Postman collections in `postman/`

## Repository Layout

```text
backend/          Laravel API, database migrations, seeders, models, controllers
frontend/         React/Vite application
postman/          Postman API collections and local environment
docs/             Project documentation, demo script, user manual, presentation notes
tools/websocket/  Optional local websocket/test helper scripts
```

Root-level `package.json` exists for optional Node helper scripts. The main application packages are inside `backend/` and `frontend/`.

## Main Features

- Customer room, table, seat, and standalone-seat reservation flows
- Admin login and reservation dashboard
- Reservation approval, rejection, cancellation, and email notification hooks
- Venue and seat map data APIs
- Local seeded data for admins, venues, seats, and sample reservations
- Optional realtime update helpers for development

## Local Development

### Requirements

- PHP 8.2+
- Composer
- Node.js 20+
- npm
- SQLite for the default local setup

### Backend Setup

```powershell
cd C:\Users\Christian\seat-table-mngmnt\backend
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

The backend runs at:

```text
http://localhost:8000
```

The API base URL is:

```text
http://localhost:8000/api
```

### Frontend Setup

```powershell
cd C:\Users\Christian\seat-table-mngmnt\frontend
npm install
npm run dev
```

The frontend usually runs at:

```text
http://localhost:5173
```

Admin login page:

```text
http://localhost:5173/login
```

## Optional Websocket Helper

Websockets keep a persistent connection open between browser and server so the server can push updates immediately instead of waiting for the browser to poll repeatedly. In this project they are intended for reservation/seat status updates during development.

Optional helper scripts were moved to:

```text
tools/websocket/
```

Example:

```powershell
node tools\websocket\websocket-server.js
```

The helper listens on:

```text
ws://localhost:6001
```

Some shell/plist files in `tools/websocket/` are legacy macOS helpers and may need path edits before use.

## Deployment Notes

### Backend

1. Set production environment variables in `backend/.env`.
2. Use a real database such as MySQL or a managed database service.
3. Run:

```bash
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

4. Point the web server document root to `backend/public`.
5. Configure queues, mail, CORS, and broadcasting for the production host.

### Frontend

1. Set `VITE_API_BASE_URL` to the production API URL.
2. Build the frontend:

```bash
cd frontend
npm ci
npm run build
```

3. Deploy `frontend/dist` to a static host or web server.

## Useful Commands

Run backend tests:

```powershell
cd backend
php artisan test
```

Build frontend:

```powershell
cd frontend
npm run build
```

Open API collection:

```text
postman/collections/Seat-Table Management API/
```

## Documentation

- `docs/USER_MANUAL.md`
- `docs/DEMO_SCRIPT.md`
- `docs/PRESENTATION_SLIDES.md`
- `docs/ENVIRONMENT.md`
