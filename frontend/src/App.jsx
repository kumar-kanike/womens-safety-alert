import { useEffect, useMemo, useState } from 'react'
import './App.css'

// In development, always use the same-origin Vite proxy. This deliberately ignores
// stale VITE_API_URL values left in local .env files in Codespaces.
const API = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const emptyForm = { name: '', phone: '', relationship: '' }

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  const data = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.detail || Object.values(data || {}).flat().join(' ') || 'Request failed')
  return data
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('ws_access') || '')
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [auth, setAuth] = useState({ username: '', email: '', password: '' })
  const [contacts, setContacts] = useState([])
  const [alerts, setAlerts] = useState([])
  const [contactForm, setContactForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sosBusy, setSosBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [location, setLocation] = useState(null)

  const activeContacts = useMemo(() => contacts.length, [contacts])

  async function loadDashboard(access = token) {
    const [profile, savedContacts, history] = await Promise.all([
      request('/api/accounts/profile/', { token: access }),
      request('/api/contacts/', { token: access }),
      request('/api/alerts/history/', { token: access }),
    ])
    setUser(profile)
    setContacts(savedContacts)
    setAlerts(history)
  }

  useEffect(() => {
    if (!token) return
    loadDashboard(token).catch((err) => {
      setError(err.message)
      localStorage.removeItem('ws_access')
      setToken('')
    })
  }, [token])

  function logout() {
    localStorage.removeItem('ws_access')
    setToken('')
    setUser(null)
    setContacts([])
    setAlerts([])
    setNotice('You have been signed out.')
  }

  async function submitAuth(event) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      if (authMode === 'register') {
        await request('/api/accounts/register/', { method: 'POST', body: JSON.stringify(auth) })
      }
      const result = await request('/api/token/', {
        method: 'POST',
        body: JSON.stringify({ username: auth.username, password: auth.password }),
      })
      localStorage.setItem('ws_access', result.access)
      setToken(result.access)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  function getLocation() {
    setError(''); setNotice('')
    if (!navigator.geolocation) { setError('Geolocation is not supported by this browser.'); return }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitude: coords.latitude, longitude: coords.longitude })
        setNotice('Your current coordinates were retrieved. They are not shared until you trigger SOS.')
      },
      (err) => setError(err.code === 1 ? 'Location permission was denied. Allow location access in your browser.' : 'Could not get your location. Check GPS and try again.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
    )
  }

  async function saveContact(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const path = editingId ? `/api/contacts/${editingId}/` : '/api/contacts/'
      await request(path, {
        token, method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(contactForm),
      })
      setContactForm(emptyForm); setEditingId(null)
      await loadDashboard()
      setNotice(editingId ? 'Emergency contact updated.' : 'Emergency contact saved.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function deleteContact(id) {
    if (!window.confirm('Delete this emergency contact?')) return
    try {
      await request(`/api/contacts/${id}/`, { token, method: 'DELETE' })
      await loadDashboard()
      setNotice('Contact deleted.')
    } catch (err) { setError(err.message) }
  }

  async function triggerSOS() {
    if (sosBusy) return
    if (!window.confirm('Create an SOS alert and share your current location? Only proceed if you need help.')) return
    setSosBusy(true); setError(''); setNotice('')
    try {
      let coords = location
      if (!coords) {
        coords = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error('This browser does not support location access.'))
          navigator.geolocation.getCurrentPosition(
            ({ coords: c }) => resolve({ latitude: c.latitude, longitude: c.longitude }),
            () => reject(new Error('Location unavailable. Allow location permission and try again.')),
            { enableHighAccuracy: true, timeout: 15000 },
          )
        })
        setLocation(coords)
      }
      const created = await request('/api/alerts/sos/', {
        token, method: 'POST',
        body: JSON.stringify({ ...coords, message: 'Emergency SOS alert' }),
      })
      await loadDashboard()
      setNotice('SOS event saved to your account. Your browser has NOT automatically sent an SMS or contacted emergency services.')
      if (contacts.length) {
        const mapLink = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`
        const body = encodeURIComponent(`EMERGENCY: I need help. My location: ${mapLink}`)
        const numbers = contacts.map((c) => c.phone).join(',')
        window.location.href = `sms:${numbers}?body=${body}`
      }
      return created
    } catch (err) { setError(err.message) } finally { setSosBusy(false) }
  }

  if (!token) return (
    <main className="auth-shell">
      <section className="auth-art">
        <div className="brand-mark">✦</div>
        <p className="eyebrow">PERSONAL SAFETY, MADE SIMPLE</p>
        <h1>Your safety.<br />Your people.<br /><em>One tap away.</em></h1>
        <p className="art-copy">Keep trusted contacts close and make it easier to share your location when you need support.</p>
        <div className="art-note">A support tool — not a replacement for emergency services.</div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow">WOMEN'S SAFETY ALERT</span>
          <h2>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="muted">Sign in to manage your trusted contacts and safety alerts.</p>
          <form onSubmit={submitAuth}>
            <label>Username<input required autoComplete="username" value={auth.username} onChange={e => setAuth({ ...auth, username: e.target.value })} /></label>
            {authMode === 'register' && <label>Email<input required type="email" autoComplete="email" value={auth.email} onChange={e => setAuth({ ...auth, email: e.target.value })} /></label>}
            <label>Password<input required minLength="8" type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={auth.password} onChange={e => setAuth({ ...auth, password: e.target.value })} /></label>
            <button className="primary full" disabled={busy}>{busy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button>
          </form>
          <p className="switch-auth">{authMode === 'login' ? 'New here?' : 'Already registered?'} <button className="link-button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError('') }}>{authMode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
          {error && <p className="alert error">{error}</p>}
          {notice && <p className="alert success">{notice}</p>}
        </div>
      </section>
    </main>
  )

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-icon">✦</span><span>safe<span className="brand-accent">her</span><small>PERSONAL SAFETY SPACE</small></span></a>
        <div className="top-actions"><span className="user-chip">● {user?.username || 'Account'}</span><button className="text-button" onClick={logout}>Sign out ↗</button></div>
      </header>
      <section className="welcome">
        <div><p className="eyebrow">YOUR PERSONAL SAFETY SPACE</p><h1>Good to see you, {user?.username || 'there'}.</h1><p className="muted">A little preparation can make it easier to reach the people you trust.</p></div>
        <div className="date-pill">✦ &nbsp; Stay aware. Stay connected.</div>
      </section>
      {(error || notice) && <div className={`alert ${error ? 'error' : 'success'}`}>{error || notice}<button onClick={() => { setError(''); setNotice('') }}>×</button></div>}
      <section className="sos-layout">
        <div className="sos-card">
          <div className="sos-copy"><span className="eyebrow light">NEED HELP RIGHT NOW?</span><h2>Send an SOS alert</h2><p>Save an emergency event with your current GPS coordinates, then open your phone's SMS app to share your location with your trusted contacts.</p><div className="sos-warning">This app does not automatically contact police or emergency services.</div></div>
          <button className="sos-button" onClick={triggerSOS} disabled={sosBusy}><span>{sosBusy ? '…' : 'SOS'}</span><small>{sosBusy ? 'SENDING' : 'TAP FOR HELP'}</small></button>
        </div>
        <div className="location-card"><div className="card-heading"><span className="icon-bubble">⌖</span><span><b>Your location</b><small>GPS LOCATION STATUS</small></span></div><div className="location-value">{location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'Location not retrieved'}</div><button className="secondary full" onClick={getLocation}>⌖ &nbsp; Get my location</button><p className="tiny">Location access requires browser permission and HTTPS (localhost is also allowed).</p></div>
      </section>
      <section className="stats-grid">
        <article className="stat-card"><span className="stat-icon pink">♡</span><div><strong>{activeContacts}</strong><small>TRUSTED CONTACTS</small></div></article>
        <article className="stat-card"><span className="stat-icon peach">⌁</span><div><strong>{alerts.length}</strong><small>SAVED SOS EVENTS</small></div></article>
        <article className="stat-card"><span className="stat-icon green">✓</span><div><strong>Active</strong><small>ACCOUNT STATUS</small></div></article>
      </section>
      <section className="content-grid">
        <div className="panel">
          <div className="panel-title"><div><p className="eyebrow">YOUR SUPPORT CIRCLE</p><h2>Emergency contacts</h2></div><span className="count">{contacts.length} saved</span></div>
          <form className="contact-form" onSubmit={saveContact}>
            <label>Full name<input required maxLength="100" placeholder="e.g. Priya Kumar" value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} /></label>
            <label>Phone number<input required maxLength="20" placeholder="+91 98765 43210" value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} /></label>
            <label>Relationship<input maxLength="50" placeholder="Friend, family…" value={contactForm.relationship} onChange={e => setContactForm({ ...contactForm, relationship: e.target.value })} /></label>
            <div className="form-actions"><button className="primary" disabled={busy}>{editingId ? 'Save changes' : '＋ Add contact'}</button>{editingId && <button type="button" className="secondary" onClick={() => { setEditingId(null); setContactForm(emptyForm) }}>Cancel</button>}</div>
          </form>
          <div className="contact-list">{contacts.length === 0 ? <div className="empty-state"><span>♡</span><b>No contacts added yet</b><p>Add people you trust so you can reach them quickly.</p></div> : contacts.map(contact => <div className="contact-row" key={contact.id}><span className="avatar">{contact.name.slice(0, 1).toUpperCase()}</span><div className="contact-info"><b>{contact.name}</b><small>{contact.relationship || 'Trusted contact'} · {contact.phone}</small></div><button className="icon-button" title="Edit contact" onClick={() => { setEditingId(contact.id); setContactForm({ name: contact.name, phone: contact.phone, relationship: contact.relationship || '' }) }}>✎</button><button className="icon-button delete" title="Delete contact" onClick={() => deleteContact(contact.id)}>×</button></div>)}</div>
        </div>
        <div className="panel history-panel">
          <div className="panel-title"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Safety history</h2></div></div>
          {alerts.length === 0 ? <div className="empty-state"><span>⌁</span><b>No alerts recorded</b><p>Your saved SOS events will appear here.</p></div> : <div className="history-list">{alerts.map(alert => <article className="history-item" key={alert.id}><span className="history-dot" /><div><b>{alert.message}</b><small>{new Date(alert.created_at).toLocaleString()}</small>{alert.latitude != null && alert.longitude != null && <a href={`https://maps.google.com/?q=${alert.latitude},${alert.longitude}`} target="_blank" rel="noreferrer">View saved location ↗</a>}</div><span className="status-tag">{alert.status}</span></article>)}</div>}
          <div className="help-box"><b>In immediate danger?</b><p>Call your local emergency number. In India, dial <strong>112</strong>. Do not wait for this app if you need urgent help.</p><a href="tel:112">Call 112 ↗</a></div>
        </div>
      </section>
      <footer>Made for safer connections <span>•</span> Your data should stay private. Never share your password or OTP.</footer>
    </main>
  )
}

export default App
