import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, initializeDatabase } from './db.js';

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.');
}

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(v => v.trim()), credentials: false }));
app.use(express.json({ limit: '32kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/token', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const signAccess = user => jwt.sign({ sub: String(user.id), username: user.username }, JWT_SECRET, { expiresIn: process.env.JWT_ACCESS_TTL || '15m' });
const signRefresh = user => jwt.sign({ sub: String(user.id), type: 'refresh' }, JWT_SECRET, { expiresIn: process.env.JWT_REFRESH_TTL || '7d' });

function authenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ detail: 'Authentication credentials were not provided.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type === 'refresh') return res.status(401).json({ detail: 'Use an access token for this request.' });
    req.user = { id: Number(payload.sub), username: payload.username };
    next();
  } catch {
    return res.status(401).json({ detail: 'Token is invalid or expired.' });
  }
}

const validPhone = value => typeof value === 'string' && /^\+?[0-9][0-9\s().-]{5,18}$/.test(value.trim());
const validCoordinate = (value, min, max) => value === null || value === undefined || (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max);

app.get('/', (_req, res) => res.json({ message: "Women's Safety Alert API is running", status: 'success', runtime: 'nodejs' }));
app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
}));

// Keep the Django REST endpoint contract so the existing React screens continue to work.
app.post('/api/accounts/register/', asyncRoute(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username)) return res.status(400).json({ username: ['Use 3-50 letters, numbers, dots, underscores or hyphens.'] });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ email: ['Enter a valid email address.'] });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ password: ['Password must contain 8-72 characters.'] });
  const [existing] = await pool.execute('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1', [username, email]);
  if (existing.length) return res.status(409).json({ detail: 'An account with this username or email already exists.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute('INSERT INTO users (username,email,password_hash) VALUES (?,?,?)', [username, email, passwordHash]);
  res.status(201).json({ id: result.insertId, username, email });
}));

app.post('/api/token/', asyncRoute(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const [rows] = await pool.execute('SELECT id, username, email, password_hash FROM users WHERE username = ? LIMIT 1', [username]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ detail: 'No active account found with the supplied credentials.' });
  }
  const user = rows[0];
  res.json({ access: signAccess(user), refresh: signRefresh(user) });
}));

app.post('/api/token/refresh/', asyncRoute(async (req, res) => {
  try {
    const payload = jwt.verify(String(req.body.refresh || ''), JWT_SECRET);
    if (payload.type !== 'refresh') throw new Error('Invalid refresh token');
    const [rows] = await pool.execute('SELECT id, username FROM users WHERE id = ? LIMIT 1', [Number(payload.sub)]);
    if (!rows.length) return res.status(401).json({ detail: 'Account no longer exists.' });
    res.json({ access: signAccess(rows[0]), refresh: signRefresh(rows[0]) });
  } catch {
    res.status(401).json({ detail: 'Refresh token is invalid or expired.' });
  }
}));

app.get('/api/accounts/profile/', authenticate, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT id, username, email FROM users WHERE id = ? LIMIT 1', [req.user.id]);
  if (!rows.length) return res.status(404).json({ detail: 'Account not found.' });
  res.json(rows[0]);
}));

app.get('/api/contacts/', authenticate, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT id, name, phone, relationship, created_at FROM emergency_contacts WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json(rows);
}));

app.post('/api/contacts/', authenticate, asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const relationship = String(req.body.relationship || '').trim();
  if (!name || name.length > 100) return res.status(400).json({ name: ['Contact name is required (max 100 characters).'] });
  if (!validPhone(phone)) return res.status(400).json({ phone: ['Enter a valid phone number.'] });
  if (relationship.length > 50) return res.status(400).json({ relationship: ['Relationship must be 50 characters or fewer.'] });
  const [result] = await pool.execute('INSERT INTO emergency_contacts (user_id,name,phone,relationship) VALUES (?,?,?,?)', [req.user.id, name, phone, relationship]);
  const [rows] = await pool.execute('SELECT id,name,phone,relationship,created_at FROM emergency_contacts WHERE id = ? AND user_id = ?', [result.insertId, req.user.id]);
  res.status(201).json(rows[0]);
}));

app.get('/api/contacts/:id/', authenticate, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT id,name,phone,relationship,created_at FROM emergency_contacts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ detail: 'Contact not found.' });
  res.json(rows[0]);
}));

app.put('/api/contacts/:id/', authenticate, asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const relationship = String(req.body.relationship || '').trim();
  if (!name || name.length > 100) return res.status(400).json({ name: ['Contact name is required (max 100 characters).'] });
  if (!validPhone(phone)) return res.status(400).json({ phone: ['Enter a valid phone number.'] });
  if (relationship.length > 50) return res.status(400).json({ relationship: ['Relationship must be 50 characters or fewer.'] });
  const [result] = await pool.execute('UPDATE emergency_contacts SET name=?,phone=?,relationship=? WHERE id=? AND user_id=?', [name, phone, relationship, req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ detail: 'Contact not found.' });
  const [rows] = await pool.execute('SELECT id,name,phone,relationship,created_at FROM emergency_contacts WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json(rows[0]);
}));

app.delete('/api/contacts/:id/', authenticate, asyncRoute(async (req, res) => {
  const [result] = await pool.execute('DELETE FROM emergency_contacts WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ detail: 'Contact not found.' });
  res.status(204).end();
}));

app.post('/api/alerts/sos/', authenticate, asyncRoute(async (req, res) => {
  const { latitude = null, longitude = null } = req.body;
  const message = String(req.body.message || 'Emergency SOS alert').trim().slice(0, 255) || 'Emergency SOS alert';
  if (!validCoordinate(latitude, -90, 90)) return res.status(400).json({ latitude: ['Latitude must be between -90 and 90.'] });
  if (!validCoordinate(longitude, -180, 180)) return res.status(400).json({ longitude: ['Longitude must be between -180 and 180.'] });
  const [result] = await pool.execute('INSERT INTO emergency_alerts (user_id,latitude,longitude,message) VALUES (?,?,?,?)', [req.user.id, latitude, longitude, message]);
  const [rows] = await pool.execute('SELECT id,latitude,longitude,message,status,created_at FROM emergency_alerts WHERE id=? AND user_id=?', [result.insertId, req.user.id]);
  res.status(201).json(rows[0]);
}));

app.get('/api/alerts/history/', authenticate, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT id,latitude,longitude,message,status,created_at FROM emergency_alerts WHERE user_id=? ORDER BY created_at DESC', [req.user.id]);
  res.json(rows);
}));

app.use((req, res) => res.status(404).json({ detail: 'Route not found.' }));
app.use((err, _req, res, _next) => {
  // Do not expose SQL errors, stack traces, credentials, or internal details to clients.
  console.error(err);
  res.status(500).json({ detail: 'An unexpected server error occurred.' });
});

const start = async () => {
  await initializeDatabase();
  app.listen(PORT, '0.0.0.0', () => console.log(`SafeHer Node API listening on port ${PORT}`));
};
start().catch(error => {
  console.error('SafeHer API failed to start. Check database configuration and connectivity.', error.message);
  process.exit(1);
});
