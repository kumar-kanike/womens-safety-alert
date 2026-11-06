# SafeHer — Women's Safety Alert

SafeHer is a React + Node.js/Express + MongoDB safety-support application. It lets a signed-in user manage trusted contacts, retrieve browser GPS coordinates, save SOS event records, and review personal alert history.

> **Safety limitation:** this is a support prototype, not a monitored emergency-response service. Saving an SOS record does not notify police, emergency services, or contacts automatically. The browser may open the device SMS app with a prepared message, but the user must review and send it. Do not rely on this app as your only emergency plan. In India, call **112** for immediate emergency assistance.

## Features
- Account registration and JWT access/refresh tokens.
- Password hashing with bcrypt.
- Private emergency contacts with add, edit, list and delete operations.
- Browser geolocation with explicit user permission.
- Authenticated SOS event creation and personal alert history.
- MongoDB document models and user-scoped queries.
- Responsive React dashboard and sign-out.

## Stack
- Frontend: React 19 + Vite
- Backend: Node.js + Express
- Database: MongoDB Atlas M0 (database: `safeher_db`)
- ODM: Mongoose
- Authentication: JWT + bcrypt
- Security: Helmet, CORS allow-list, rate limiting, input validation

## Configure MongoDB
1. Create a MongoDB Atlas database user and allow the backend host's IP address in Network Access.
2. Copy the cluster connection string. Replace the username and password placeholders; URL-encode special characters in the password.
3. Keep the connection string in `backend/.env`. Never commit it.

## Run the backend
Requirements: Node.js 20+ and npm.

```bash
cd backend
npm install
cp .env.example .env
```

Set `MONGODB_URI`, `MONGODB_DB=safeher_db`, a unique `JWT_SECRET` (at least 32 characters), and `CORS_ORIGIN` in `backend/.env`.

```bash
npm run dev
```

The API listens on port 5000. Mongoose creates collections and indexes when the first documents are written.

## Run the React frontend
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open the frontend's forwarded port (normally 5173). The Vite development server proxies `/api/*` to port 5000. Browser geolocation requires HTTPS when deployed; localhost is permitted.

## API overview
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/accounts/register/` | Register an account |
| POST | `/api/token/` | Obtain JWT access/refresh tokens |
| POST | `/api/token/refresh/` | Refresh access token |
| GET | `/api/accounts/profile/` | Current account |
| GET, POST | `/api/contacts/` | List/create own contacts |
| GET, PUT, DELETE | `/api/contacts/{id}/` | Read/update/delete own contact |
| POST | `/api/alerts/sos/` | Save an SOS event |
| GET | `/api/alerts/history/` | List own SOS events |

## Security and safety notes
- Never commit `.env`, MongoDB credentials, or JWT secrets.
- Use HTTPS, exact production CORS origins, and restricted Atlas Network Access.
- All contacts and alerts are scoped to the authenticated user.
- SOS records are not proof of message delivery or emergency-service notification.
- Add and independently test a consent-based notification provider before claiming contacts are notified.
- Define retention, account deletion, abuse prevention, backups, and incident-response policies before real-world use.

## Migration note
The active backend is Node.js/Express with MongoDB. The old Django files remain temporarily for reference and can be removed after the migrated app is tested.
