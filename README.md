# SafeHer — Women's Safety Alert

SafeHer is a React + Node.js/Express + MySQL safety-support application. It allows a signed-in user to manage trusted contacts, retrieve browser GPS coordinates, save SOS event records, and review personal alert history.

> **Safety limitation:** this is a support prototype, not a monitored emergency-response service. Saving an SOS record does not notify police, emergency services, or contacts automatically. The browser may open the device SMS app with a prepared message, but the user must review and send it. Do not rely on this app as your only emergency plan. In India, call **112** for immediate emergency assistance.

## Features
- Account registration and JWT access/refresh tokens.
- Password hashing with bcrypt.
- Private emergency contacts with add, edit, list and delete operations.
- Browser geolocation with explicit user permission.
- Authenticated SOS event creation and personal alert history.
- Parameterized SQL queries and user-scoped data access.
- Responsive React dashboard and sign-out.
- Aiven MySQL-compatible connection with TLS support.

## Stack
- Frontend: React 19 + Vite
- Backend: Node.js + Express
- Database: MySQL 8.4 (Aiven)
- Authentication: JWT + bcrypt
- Security: Helmet, CORS allow-list, rate limiting, input validation

## Project structure
```text
.
├── backend/
│   ├── server.js          # Express API; keeps the previous Django API routes
│   ├── db.js              # MySQL pool and idempotent schema initialization
│   ├── package.json
│   ├── .env.example
│   └── Procfile
└── frontend/
    ├── src/
    ├── package.json
    └── vite.config.js
```

The old Django source files are retained in the repository as migration reference only. The active backend entry point is now `backend/server.js`; Python is not required to run the migrated API.

## 1. Configure Aiven MySQL
Create an Aiven MySQL service and a database named `safeher_db`. Copy the service connection details from Aiven's **Connection information** page. Keep the password private.

The service must allow connections from the backend deployment. Use the Aiven CA certificate when your hosting environment does not already trust the certificate chain.

## 2. Run the backend
Requirements: Node.js 20.19+ (or 22.12+) and npm.

```bash
cd backend
npm install
cp .env.example .env
```

Set these values in `backend/.env`:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=safeher_db`
- `DB_SSL=true` for Aiven TLS
- `JWT_SECRET`: a unique random secret of at least 32 characters
- `CORS_ORIGIN`: your frontend origin

Start the API:

```bash
npm run dev
```

The API listens on port 5000 by default. On first successful startup it creates the `users`, `emergency_contacts`, and `emergency_alerts` tables if they do not already exist. It does not drop or overwrite existing tables.

Health checks:
- `GET /`
- `GET /api/health` (also verifies the database connection)

## 3. Run the React frontend
Open another terminal:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

The Vite development server proxies `/api/*` to `http://127.0.0.1:5000`. If your backend uses another address, set `BACKEND_PROXY_TARGET` in the frontend environment and restart Vite. Open the frontend's forwarded port (normally 5173) in Codespaces.

Build check:

```bash
npm run build
```

Browser geolocation requires HTTPS when deployed; localhost is permitted.

## API overview
The migrated Express API preserves the existing frontend's Django REST route shapes:

| Method | Endpoint | Authentication | Purpose |
|---|---|---:|---|
| POST | `/api/accounts/register/` | No | Register an account |
| POST | `/api/token/` | No | Obtain JWT access/refresh tokens |
| POST | `/api/token/refresh/` | No | Refresh access token |
| GET | `/api/accounts/profile/` | Yes | Current account |
| GET, POST | `/api/contacts/` | Yes | List/create own contacts |
| GET, PUT, DELETE | `/api/contacts/{id}/` | Yes | Read/update/delete own contact |
| POST | `/api/alerts/sos/` | Yes | Save an SOS event |
| GET | `/api/alerts/history/` | Yes | List own SOS events |

Send access tokens as `Authorization: Bearer <access-token>`.

## Security notes
- Never commit `.env`, database passwords, JWT secrets, or CA private material.
- Use HTTPS, a strong unique JWT secret, and exact production CORS origins.
- Use Aiven TLS and restrict database network access to the backend host where practical.
- All user-owned contacts and alerts are queried by authenticated user ID.
- SOS records are not proof of message delivery or emergency-service notification.
- Add a real, consent-based notification provider and test it separately before claiming that contacts are notified.
- Define retention, account deletion, abuse prevention, backups, and incident-response policies before real-world use.

## Migration note
The Django API routes and JSON shapes used by the existing React app were retained to minimize frontend changes. The active backend is Node.js/Express; the Django files remain temporarily for reference and can be removed after the migrated app is tested.
