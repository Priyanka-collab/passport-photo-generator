// Simple Segmind proxy server with Google OAuth
require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const axios = require('axios')
const cors = require('cors')
const passport = require('passport')
const session = require('express-session')
const GoogleStrategy = require('passport-google-oauth20').Strategy

const app = express()

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false
}))

// Initialize Passport
app.use(passport.initialize())
app.use(passport.session())

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))
app.use(bodyParser.json({ limit: '50mb' }))

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user)
})

passport.deserializeUser((user, done) => {
  // User object is stored directly in session
  done(null, user)
})

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    // In a real app, you'd save user to database
    // For now, return profile info
    console.log('Google profile:', profile.displayName, profile.name)
    return done(null, {
      id: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      givenName: profile.name?.givenName,
      familyName: profile.name?.familyName,
      picture: profile.photos[0].value
    })
  }
))

// Middleware to require authentication
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }
  res.status(401).json({ error: 'Authentication required' })
}

app.post('/api/segmind', requireAuth, async (req, res) => {
  try {
    const apiUrl = process.env.SEGMIND_API_URL || 'https://www.segmind.com/models/qwen-image-edit-plus'
    const apiKey = process.env.SEGMIND_API_KEY
    if (!apiKey) return res.status(400).json({ error: 'SEGMIND_API_KEY not set' })

    // If the apiUrl looks like the public model page (not an inference API), return a helpful error.
    if (/segmind\.com\/models\//.test(apiUrl)) {
      return res.status(400).json({
        error: 'SEGMIND_API_URL appears to be a model page, not an API endpoint',
        detail: 'Please set SEGMIND_API_URL to the inference API endpoint (see Segmind docs). Example: https://api.segmind.com/v1/image/edit'
      })
    }

    // If the client sent multipart/form-data (FormData with files), forward the raw stream
    // directly to the upstream Segmind API. This lets the browser simply POST a file and
    // avoids parsing multipart on the proxy.
    const contentTypeHeader = req.headers['content-type'] || ''
    if (contentTypeHeader.startsWith('multipart/form-data')) {
      try {
        // Forward the incoming request stream directly to Segmind. Axios accepts a stream as the body.
        const headers = Object.assign({ Authorization: `Bearer ${apiKey}`, 'Content-Type': contentTypeHeader }, {})
        const r = await axios.post(apiUrl, req, { headers, timeout: 120000, responseType: 'arraybuffer', maxContentLength: Infinity, maxBodyLength: Infinity })
        const ct = (r.headers && r.headers['content-type']) || ''
        if (ct.includes('application/json')) {
          const text = Buffer.from(r.data).toString('utf8')
          try { return res.status(r.status).json(JSON.parse(text)) } catch (e) { return res.status(r.status).json({ body: text }) }
        }
        if (ct.startsWith('image/') || ct === '') {
          const mime = ct.split(';')[0] || 'image/png'
          const b64 = Buffer.from(r.data).toString('base64')
          return res.status(200).json({ images: [`data:${mime};base64,${b64}`] })
        }
        const text = Buffer.from(r.data).toString('utf8')
        return res.status(r.status).json({ body: text })
      } catch (err) {
        console.error('Error forwarding multipart to Segmind:', err?.response?.status, err?.response?.data || err.message)
        const status = err?.response?.status || 502
        let detail = err?.response?.data || err.message
        if (Buffer.isBuffer(detail)) {
          try { detail = Buffer.from(detail).toString('utf8') } catch (_) {}
        }
        return res.status(status).json({ error: 'Segmind proxy failed (multipart)', detail })
      }
    }

    // Try multiple candidate payload shapes derived from the incoming body.
    // This helps when the upstream expects slightly different field names or data-uri vs raw base64.
    const incoming = req.body || {}
    const maybeB64 = (() => {
      if (Array.isArray(incoming.init_images) && incoming.init_images[0]) return incoming.init_images[0]
      if (incoming.image) return incoming.image.replace(/^data:image\/[a-z]+;base64,/, '')
      if (incoming.init_image) return incoming.init_image
      if (incoming.inputs && Array.isArray(incoming.inputs.init_images) && incoming.inputs.init_images[0]) return incoming.inputs.init_images[0]
      return null
    })()
    const maybeMask = incoming.mask || incoming.mask_data_uri || (incoming.inputs && incoming.inputs.mask) || null
    const prompt = incoming.prompt || (incoming.inputs && incoming.inputs.prompt) || ''
    const w = incoming.width || (incoming.inputs && incoming.inputs.width) || undefined
    const h = incoming.height || (incoming.inputs && incoming.inputs.height) || undefined

    if (!maybeB64) {
      // nothing to try
      throw new Error('No init image found in proxy request')
    }

    const dataUri = (s) => (s && s.startsWith('data:') ? s : 'data:image/png;base64,' + s)

    const candidates = [
      // raw base64 + mask
      { model: incoming.model || 'qwen-image-edit-plus', prompt, width: w, height: h, init_images: [maybeB64], mask: maybeMask },
      // top-level data URI
      { model: incoming.model || 'qwen-image-edit-plus', prompt, width: w, height: h, image: dataUri(maybeB64), mask: dataUri(maybeMask) },
      // data-uri array
      { model: incoming.model || 'qwen-image-edit-plus', prompt, width: w, height: h, init_images: [dataUri(maybeB64)], mask_data_uri: dataUri(maybeMask) },
      // singular fields
      { model: incoming.model || 'qwen-image-edit-plus', prompt, width: w, height: h, init_image: maybeB64, mask: maybeMask },
      // inputs envelope
      { model: incoming.model || 'qwen-image-edit-plus', inputs: { init_images: [maybeB64], mask: maybeMask, prompt, width: w, height: h } },
      // additional prompt field name variations
      { model: incoming.model || 'qwen-image-edit-plus', instruction: prompt, width: w, height: h, init_images: [maybeB64], mask: maybeMask },
      { model: incoming.model || 'qwen-image-edit-plus', text: prompt, width: w, height: h, init_images: [maybeB64], mask: maybeMask },
      { model: incoming.model || 'qwen-image-edit-plus', caption: prompt, width: w, height: h, init_images: [maybeB64], mask: maybeMask },
      { model: incoming.model || 'qwen-image-edit-plus', prompt_text: prompt, width: w, height: h, init_images: [maybeB64], mask: maybeMask },
      // inputs envelope with instruction key
      { model: incoming.model || 'qwen-image-edit-plus', inputs: { init_images: [maybeB64], mask: maybeMask, instruction: prompt, width: w, height: h } },
      // try raw data-uri under different names
      { model: incoming.model || 'qwen-image-edit-plus', image_data_uri: dataUri(maybeB64), mask_data_uri: dataUri(maybeMask), prompt },
    ]

    let lastErr = null
    for (const candidate of candidates) {
      try {
        const r = await axios.post(apiUrl, candidate, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000, responseType: 'arraybuffer' })
        const contentType = (r.headers && r.headers['content-type']) || ''
        if (contentType.includes('application/json')) {
          const text = Buffer.from(r.data).toString('utf8')
          try {
            let parsed = JSON.parse(text)
                // normalize any Buffer-like objects in parsed into readable strings
                function normalizeBuffers(obj) {
                  if (!obj || typeof obj !== 'object') return obj
                  if (Array.isArray(obj)) return obj.map(normalizeBuffers)
                  // Buffer-like object from Node -> { type: 'Buffer', data: [...] }
                  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
                    try {
                      return Buffer.from(obj.data).toString('utf8')
                    } catch (e) {
                      // fallback: return small preview
                      return obj.data.slice(0, 200).map((n) => (n >= 32 && n <= 126 ? String.fromCharCode(n) : '?')).join('')
                    }
                  }
                  const out = {}
                  for (const k of Object.keys(obj)) {
                    out[k] = normalizeBuffers(obj[k])
                  }
                  return out
                }
                parsed = normalizeBuffers(parsed)
                return res.status(r.status).json(parsed)
          } catch (e) {
            return res.status(r.status).json({ body: text })
          }
        }
        if (contentType.startsWith('image/') || contentType === '') {
          const mime = contentType.split(';')[0] || 'image/png'
          const b64 = Buffer.from(r.data).toString('base64')
          const dataUriResp = `data:${mime};base64,${b64}`
          return res.status(200).json({ images: [dataUriResp] })
        }
        // fallback: try to decode as text
        try {
          const text = Buffer.from(r.data).toString('utf8')
          return res.status(r.status).json({ body: text })
        } catch (e) {
          // ignore and try next candidate
        }
      } catch (err) {
        lastErr = err
        // continue to next candidate
      }
    }
    // If we reach here, none succeeded
    // As a last resort, try multipart/form-data upload (some endpoints expect files)
    try {
      // require here so server still starts if form-data is not installed
      const FormData = require('form-data')
      const form = new FormData()
      // attach init image buffer
      const b64 = maybeB64.replace(/^data:image\/[a-z]+;base64,/, '')
      const imgBuf = Buffer.from(b64, 'base64')
      form.append('image', imgBuf, { filename: 'init.png', contentType: 'image/png' })
      // attach mask if present
      if (maybeMask) {
        const mb = maybeMask.replace(/^data:image\/[a-z]+;base64,/, '')
        const maskBuf = Buffer.from(mb, 'base64')
        form.append('mask', maskBuf, { filename: 'mask.png', contentType: 'image/png' })
      }
      if (prompt) form.append('prompt', prompt)
      const headers = Object.assign({ Authorization: `Bearer ${apiKey}` }, form.getHeaders())
      const r2 = await axios.post(apiUrl, form, { headers, timeout: 120000, responseType: 'arraybuffer' })
  console.log('Multipart attempt response status:', r2.status)
  console.log('Multipart attempt response headers:', r2.headers)
  const contentType2 = (r2.headers && r2.headers['content-type']) || ''
      if (contentType2.includes('application/json')) {
        const text = Buffer.from(r2.data).toString('utf8')
        try {
          const parsed = JSON.parse(text)
          return res.status(r2.status).json(parsed)
        } catch (e) {
          return res.status(r2.status).json({ body: text })
        }
      }
      if (contentType2.startsWith('image/') || contentType2 === '') {
        const mime = contentType2.split(';')[0] || 'image/png'
        const b64r = Buffer.from(r2.data).toString('base64')
        const dataUriResp = `data:${mime};base64,${b64r}`
        return res.status(200).json({ images: [dataUriResp] })
      }
    } catch (fmErr) {
      // swallow and report below
      lastErr = lastErr || fmErr
    }

    throw lastErr || new Error('All candidate payloads failed')
  } catch (err) {
    // If upstream responded with status and data, decode that data for a readable error
    const upstreamStatus = err?.response?.status
    let upstreamData = err?.response?.data
    try {
      // If it's a Buffer, decode to UTF-8 string
      if (Buffer.isBuffer(upstreamData)) {
        const txt = Buffer.from(upstreamData).toString('utf8')
        try {
          upstreamData = JSON.parse(txt)
        } catch (e) {
          upstreamData = txt
        }
      } else if (upstreamData && upstreamData.type === 'Buffer' && Array.isArray(upstreamData.data)) {
        const txt = Buffer.from(upstreamData.data).toString('utf8')
        try {
          upstreamData = JSON.parse(txt)
        } catch (e) {
          upstreamData = txt
        }
      }
    } catch (e) {
      // ignore decode errors and fall back
    }

    console.error('Segmind proxy error', upstreamData || err.message || err)
    if (upstreamStatus) {
      return res.status(upstreamStatus).json({ error: 'Segmind proxy failed', detail: upstreamData })
    }
    return res.status(500).json({ error: 'Segmind proxy failed', detail: err.message || err })
  }
})

// Authentication routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication, redirect to frontend
    res.redirect('http://localhost:5173')
  }
)

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('http://localhost:5173')
  })
})

app.get('/auth/user', (req, res) => {
  if (req.isAuthenticated()) {
    // In a real app, fetch user credits/subscription from database
    // For now, return mock data
    const userWithCredits = {
      ...req.user,
      credits: req.user.credits || 0,
      hasSubscription: req.user.hasSubscription || false
    }
    res.json({ user: userWithCredits })
  } else {
    res.json({ user: null })
  }
})

// Simple health endpoint so the frontend can quickly check proxy/key status
app.get('/api/health', (req, res) => {
  const hasKey = !!process.env.SEGMIND_API_KEY
  const apiUrl = process.env.SEGMIND_API_URL || ''
  const looksLikeModelPage = /segmind\.com\/models\//.test(apiUrl)
  res.json({ ok: true, hasKey, apiUrl, looksLikeModelPage })
})

const port = process.env.PORT || 3001
app.listen(port, () => console.log('Segmind proxy with Google OAuth listening on', port))
// Proxy server ready. Make sure SEGMIND_API_KEY, SEGMIND_API_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and SESSION_SECRET are set in a .env file
// and restart this process when you change them.
