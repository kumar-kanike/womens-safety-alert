import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User, EmergencyContact, SOSAlert } from './db.js';

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be a random value of at least 32 characters.');
}

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(v => v.trim()),
  credentials: false,
}));
app.use(express.json({ limit: '32kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/token', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const signAccess = user => jwt.sign({ sub: String(user._id), username: user.username }, JWT_SECRET, { expiresIn: process.env.JWT_ACCESS_TTL || '15m' });
const signRefresh = user => jwt.sign({ sub: String(user._id), type: 'refresh' }, JWT_SECRET, { expiresIn: process.env.JWT_REFRESH_TTL || '7d' });
const isObjectId = value => mongoose.Types.ObjectId.isValid(value);
const validPhone = value => typeof value === 'string' && /^\+?[0-9][0-9\s().-]{5,18}$/.test(value.trim());
const validCoordinate = (value, min, max) => value === null || value === undefined || (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max);

function authenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ detail: 'Authentication credentials were not provided.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type === 'refresh' || !isObjectId(payload.sub)) throw new Error('Invalid access token');
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ detail: 'Token is invalid or expired.' });
  }
}

const contactDto = doc => ({
  id: String(doc._id), name: doc.name, phone: doc.phone,
  relationship: doc.relationship || '', created_at: doc.createdAt,
});
const alertDto = doc => ({
  id: String(doc._id), latitude: doc.latitude, longitude: doc.longitude,
  message: doc.message, status: doc.status, created_at: doc.createdAt,
});

app.get('/', (_req, res) => res.json({ message: "Women's Safety Alert API is running", status: 'success', runtime: 'nodejs' }));
app.get('/api/health', asyncRoute(async (_req, res) => {
  await mongoose.connection.db.admin().ping();
  res.json({ status: 'ok', database: 'connected' });
}));

// Keep the existing frontend's Django REST route shapes during the backend migration.
app.post('/api/accounts/register/', asyncRoute(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username)) return res.status(400).json({ username: ['Use 3-50 letters, numbers, dots, underscores or hyphens.'] });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ email: ['Enter a valid email address.'] });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ password: ['Password must contain 8-72 characters.'] });
  const existing = await User.findOne({ $or: [{ username }, { email }] }).lean();
  if (existing) return res.status(409).json({ detail: 'An account with this username or email already exists.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ username, email, passwordHash });
  res.status(201).json({ id: String(user._id), username, email });
}));

app.post('/api/token/', asyncRoute(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ detail: 'No active account found with the supplied credentials.' });
  }
  res.json({ access: signAccess(user), refresh: signRefresh(user) });
}));

app.post('/api/token/refresh/', asyncRoute(async (req, res) => {
  try {
    const payload = jwt.verify(String(req.body.refresh || ''), JWT_SECRET);
    if (payload.type !== 'refresh' || !isObjectId(payload.sub)) throw new Error('Invalid refresh token');
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ detail: 'Account no longer exists.' });
    res.json({ access: signAccess(user), refresh: signRefresh(user) });
  } catch {
    res.status(401).json({ detail: 'Refresh token is invalid or expired.' });
  }
}));

app.get('/api/accounts/profile/', authenticate, asyncRoute(async (req, res) => {
  const user = await User.findById(req.user.id).select('username email').lean();
  if (!user) return res.status(404).json({ detail: 'Account not found.' });
  res.json({ id: String(user._id), username: user.username, email: user.email });
}));

app.get('/api/contacts/', authenticate, asyncRoute(async (req, res) => {
  const contacts = await EmergencyContact.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json(contacts.map(contactDto));
}));

app.post('/api/contacts/', authenticate, asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const relationship = String(req.body.relationship || '').trim();
  if (!name || name.length > 100) return res.status(400).json({ name: ['Contact name is required (max 100 characters).'] });
  if (!validPhone(phone)) return res.status(400).json({ phone: ['Enter a valid phone number.'] });
  if (relationship.length > 50) return res.status(400).json({ relationship: ['Relationship must be 50 characters or fewer.'] });
  const contact = await EmergencyContact.create({ userId: req.user.id, name, phone, relationship });
  res.status(201).json(contactDto(contact));
}));

app.get('/api/contacts/:id/', authenticate, asyncRoute(async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(404).json({ detail: 'Contact not found.' });
  const contact = await EmergencyContact.findOne({ _id: req.params.id, userId: req.user.id }).lean();
  if (!contact) return res.status(404).json({ detail: 'Contact not found.' });
  res.json(contactDto(contact));
}));

app.put('/api/contacts/:id/', authenticate, asyncRoute(async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(404).json({ detail: 'Contact not found.' });
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const relationship = String(req.body.relationship || '').trim();
  if (!name || name.length > 100) return res.status(400).json({ name: ['Contact name is required (max 100 characters).'] });
  if (!validPhone(phone)) return res.status(400).json({ phone: ['Enter a valid phone number.'] });
  if (relationship.length > 50) return res.status(400).json({ relationship: ['Relationship must be 50 characters or fewer.'] });
  const contact = await EmergencyContact.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: { name, phone, relationship } },
    { new: true, runValidators: true },
  );
  if (!contact) return res.status(404).json({ detail: 'Contact not found.' });
  res.json(contactDto(contact));
}));

app.delete('/api/contacts/:id/', authenticate, asyncRoute(async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(404).json({ detail: 'Contact not found.' });
  const result = await EmergencyContact.deleteOne({ _id: req.params.id, userId: req.user.id });
  if (!result.deletedCount) return res.status(404).json({ detail: 'Contact not found.' });
  res.status(204).end();
}));

app.post('/api/alerts/sos/', authenticate, asyncRoute(async (req, res) => {
  const { latitude = null, longitude = null } = req.body;
  const message = String(req.body.message || 'Emergency SOS alert').trim().slice(0, 255) || 'Emergency SOS alert';
  if (!validCoordinate(latitude, -90, 90)) return res.status(400).json({ latitude: ['Latitude must be between -90 and 90.'] });
  if (!validCoordinate(longitude, -180, 180)) return res.status(400).json({ longitude: ['Longitude must be between -180 and 180.'] });
  const alert = await SOSAlert.create({
    userId: req.user.id,
    latitude: latitude == null ? null : Number(latitude),
    longitude: longitude == null ? null : Number(longitude),
    message,
  });
  res.status(201).json(alertDto(alert));
}));

app.get('/api/alerts/history/', authenticate, asyncRoute(async (req, res) => {
  const alerts = await SOSAlert.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json(alerts.map(alertDto));
}));

app.use((req, res) => res.status(404).json({ detail: 'Route not found.' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === 11000) return res.status(409).json({ detail: 'An account with this username or email already exists.' });
  res.status(500).json({ detail: 'An unexpected server error occurred.' });
});

async function start() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || 'safeher_db' });
  app.listen(PORT, '0.0.0.0', () => console.log(`SafeHer Node API listening on port ${PORT}`));
}
start().catch(error => {
  console.error('SafeHer API failed to start. Check MongoDB configuration and connectivity.', error.message);
  process.exit(1);
});
