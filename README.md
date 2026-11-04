# SafeHer — Women's Safety Alert

A full-stack safety-support prototype built with **React + Vite** and **Django REST Framework**. It lets a signed-in user manage trusted contacts, retrieve browser GPS coordinates, create SOS event records, and review saved alert history.

> **Important safety limitation:** this is a support prototype, not a monitored emergency-response service. Creating an SOS record does not notify police, emergency services, or contacts automatically. The browser may open the device's SMS app with a prepared message, but the user must review and send it. Do not rely on this app as your only emergency plan. In India, call **112** for immediate emergency assistance.

## Features
- Account registration and JWT sign-in.
- Private emergency contacts (each account can access only its own contacts).
- Add, edit and delete trusted contacts.
- Browser geolocation with explicit permission.
- Authenticated SOS event creation and personal alert history.
- Responsive dashboard and sign-out.
- SQLite by default for local setup; optional MySQL configuration.

## Project structure
```text
.
├── backend/
│   ├── accounts/
│   ├── alerts/
│   ├── contacts/
│   ├── config/
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    ├── package.json
    └── .env.example
```

## Requirements
- Python 3.10+
- Node.js 20.19+ or 22.12+
- npm

## Run locally

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python manage.py makemigrations accounts contacts alerts
python manage.py migrate
python manage.py createsuperuser  # optional
python manage.py runserver
```
The API is available at `http://127.0.0.1:8000`; health check: `GET /`.

Before production, set a unique random `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, and explicit `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`. Never commit your real `.env` file.

### Frontend
Open a second terminal:
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Open the Vite URL printed in the terminal (normally `http://localhost:5173`). Set `VITE_API_URL` in `frontend/.env` if the backend runs elsewhere.

### Production frontend build
```bash
cd frontend
npm run build
npm run preview
```
Geolocation requires a secure context (HTTPS) in deployed environments; localhost is permitted by browsers.

## API overview
| Method | Endpoint | Authentication | Purpose |
|---|---|---:|---|
| POST | `/api/accounts/register/` | No | Create account |
| POST | `/api/token/` | No | Obtain JWT access/refresh tokens |
| POST | `/api/token/refresh/` | No | Refresh access token |
| GET | `/api/accounts/profile/` | Yes | Current account |
| GET, POST | `/api/contacts/` | Yes | List/create own contacts |
| GET, PUT, PATCH, DELETE | `/api/contacts/{id}/` | Yes | Manage own contact |
| POST | `/api/alerts/sos/` | Yes | Save an SOS event |
| GET | `/api/alerts/history/` | Yes | List own SOS events |

Send the access token as `Authorization: Bearer <access-token>`.

## Example registration
```json
{
  "username": "sampleuser",
  "email": "sample@example.com",
  "password": "Use-a-strong-password-123"
}
```

## MySQL (optional)
Create a MySQL database, then set `DB_ENGINE=mysql`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT` in `backend/.env`. The included PyMySQL adapter is installed by the backend requirements. Run migrations after changing the database.

## Security and deployment checklist
- Use HTTPS and a strong secret key; set `DJANGO_DEBUG=false`.
- Set explicit allowed hosts and frontend CORS origins.
- Configure a persistent production database and backups.
- Add a verified SMS/notification provider before describing SOS as delivered. Keep provider credentials server-side; never place secrets in Vite variables.
- Add consent, retention, deletion, abuse-prevention and incident-response policies before real-world use.
- Test with your own controlled contacts and numbers. Never send test alerts to emergency services.

## Current scope
This repository records authenticated SOS events and location coordinates. It does **not** yet integrate SMS gateways, push notifications, live location tracking, police dispatch, or a staffed response center. SMS composition is device-dependent and is not proof of delivery.
