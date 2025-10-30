import React, { useRef, useState, useEffect } from 'react'
import { generatePassportPhoto, loadModels, callSegmind } from './passportHelper'

export default function App() {
  const [src, setSrc] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [userPrompt, setUserPrompt] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [userCredits, setUserCredits] = useState(0)
  const [hasSubscription, setHasSubscription] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    loadModels()
    checkAuthStatus()

    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (!event.target.closest('.user-dropdown')) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    // cleanup on unmount: revoke object URLs
    return () => {
      if (src) URL.revokeObjectURL(src)
      if (result?.url) URL.revokeObjectURL(result.url)
      document.removeEventListener('mousedown', handleClickOutside)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkAuthStatus() {
    try {
      const response = await fetch('/auth/user', {
        credentials: 'include'
      })
      const data = await response.json()
      console.log('User data from server:', data.user)
      setUser(data.user)
      setUserCredits(data.user?.credits || 0)
      setHasSubscription(data.user?.hasSubscription || false)
    } catch (err) {
      console.error('Failed to check auth status:', err)
    }
  }

  async function handleLogin() {
    window.location.href = '/auth/google'
  }

  async function handleLogout() {
    try {
      // Redirect to logout endpoint which will clear session and redirect back
      window.location.href = '/auth/logout'
    } catch (err) {
      console.error('Failed to logout:', err)
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // revoke previous urls
    if (src) URL.revokeObjectURL(src)
    if (result?.url) {
      URL.revokeObjectURL(result.url)
      setResult(null)
    }
    const url = URL.createObjectURL(file)
    setSrc(url)
  }

  async function onGenerate() {
    if (!src) return

    setLoading(true)
    try {
      // revoke previous result url if present
      if (result?.url) URL.revokeObjectURL(result.url)
      // First try to use the Segmind helper to professionalize the portrait.
      // If that fails, fall back to the local generatePassportPhoto crop.
      let intermediateUrl = null
      try {
        const systemPrompt = 'professional passport photo, front-facing view, neutral facial expression, appropriate business attire, white background, high quality, studio lighting, head and shoulders visible, preserve exact facial features'
        const fullPrompt = userPrompt ? `${systemPrompt}, ${userPrompt}` : systemPrompt
        const aiBlob = await callSegmind(src, {
          prompt: fullPrompt,
          width: 1024,
          height: 1024
        })
        intermediateUrl = URL.createObjectURL(aiBlob)
      } catch (aiErr) {
        console.warn('Segmind call failed, falling back to local crop:', aiErr)
      }

  const inputForCrop = intermediateUrl || src
  const blob = await generatePassportPhoto(inputForCrop, { width: 600, height: 800, backgroundColor: '#ffffff' })
  // Flatten the blob onto a canvas with white background, minimizing empty space
  const flattened = await flattenBlob(blob, '#ffffff', 600, 800)
  const url = URL.createObjectURL(flattened)
  setResult({ blob: flattened, url })

      // revoke the intermediate AI object URL if we created one
      if (intermediateUrl) {
        try { URL.revokeObjectURL(intermediateUrl) } catch (e) {}
      }
    } catch (err) {
      console.error(err)
      alert('Failed to generate passport photo: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function onDownload() {
    if (!result) return
    const a = document.createElement('a')
    a.href = result.url
    a.download = 'passport-photo.png'
    a.click()
  }

  function onClear() {
    if (src) {
      try { URL.revokeObjectURL(src) } catch (e) {}
    }
    if (result?.url) {
      try { URL.revokeObjectURL(result.url) } catch (e) {}
    }
    setSrc(null)
    setResult(null)
    setLoading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Helper: draw blob/image onto a canvas filled with bg color and return a new PNG blob
  async function flattenBlob(blob, backgroundColor, width, height) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        try {
          const c = document.createElement('canvas')
          c.width = width
          c.height = height
          const ctx = c.getContext('2d')
          ctx.fillStyle = backgroundColor || '#ffffff'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)
          c.toBlob((b) => resolve(b), 'image/png')
        } catch (e) { reject(e) }
      }
      img.onerror = reject
      img.src = URL.createObjectURL(blob)
    })
  }

  return (
    <div className="app-bg">
      <div className="container card">
        <div style={{ marginBottom: 20, position: 'relative' }}>
          <h1 style={{ textAlign: 'center', marginBottom: 10 }}>Passport Photo Generator</h1>
          <div style={{ textAlign: 'center', marginBottom: 15, color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
            <p style={{ margin: '5px 0' }}>
              Upload your photo and get a professional passport-style image with AI enhancement.
              Sign in with Google to access AI features.
            </p>
            <p style={{ margin: '5px 0', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
              <strong>Privacy Notice:</strong> Your photos are processed temporarily and not stored on our servers.
            </p>
          </div>

          {/* Authentication elements always in top right */}
          <div style={{ position: 'absolute', top: 0, right: 0 }}>
            {user ? (
              <div className="user-dropdown" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
                    Welcome, {(() => {
                      console.log('User object in UI:', user)
                      return user.givenName || user.name ? (user.givenName || user.name).split(' ')[0] : user.email ? user.email.split('@')[0] : 'User'
                    })()}
                  </div>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 8,
                      padding: '6px 12px',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    {user.picture && (
                      <img
                        src={user.picture}
                        alt="Profile"
                        style={{ width: 24, height: 24, borderRadius: '50%' }}
                      />
                    )}
                    <span>{user.name || user.email}</span>
                    <span style={{ fontSize: '12px' }}>▼</span>
                  </button>

                  {showDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      background: 'rgba(0,0,0,0.9)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 8,
                      padding: '8px 0',
                      minWidth: 150,
                      zIndex: 1000,
                      marginTop: 4
                    }}>
                      <div style={{
                        padding: '8px 16px',
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: '12px',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        marginBottom: 4
                      }}>
                        Signed in as<br/>
                        <strong>{user.email}</strong>
                      </div>
                      <button
                        onClick={handleLogout}
                        style={{
                          width: '100%',
                          padding: '8px 16px',
                          background: 'none',
                          border: 'none',
                          color: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                        onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseOut={(e) => e.target.style.background = 'none'}
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button className="primary" onClick={handleLogin} style={{ padding: '8px 16px' }}>
                Sign in with Google
              </button>
            )}
          </div>
        </div>
        <div className="controls">
          <input type="file" accept="image/*" onChange={onFile} ref={fileRef} />
          <div style={{ marginTop: 8 }}>
            <label style={{ color: 'rgba(255,255,255,0.8)', display: 'block', marginBottom: 6 }}>AI prompt (optional)</label>
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="e.g. wearing a blue shirt, smiling slightly, with glasses"
              rows={3}
              style={{ width: '100%', borderRadius: 8, padding: 8 }}
            />
          </div>
          {/* Background selection removed - now always uses white background */}

          {/* AI professionalize feature removed */}
          <div style={{ marginTop: 16 }}></div>
          <div className="button-group">
            <button className="primary" onClick={onGenerate} disabled={!src || loading || !user}>
              {loading ? 'Generating...' : user ? 'Generate Passport Photo' : 'Sign in to Generate'}
            </button>
          </div>
        </div>

        <div className="preview-row">
          <div className="preview-col">
            <h3>Original</h3>
            {src ? <img src={src} alt="original" className="preview-img" /> : <div className="empty">No image</div>}
          </div>

          <div className="preview-col">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Passport Photo</h3>
              {result && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="secondary" onClick={onDownload} style={{ padding: '6px 12px', fontSize: '12px' }}>
                    Download
                  </button>
                  <button className="tertiary" onClick={onClear} style={{ padding: '6px 12px', fontSize: '12px' }}>
                    Clear
                  </button>
                </div>
              )}
            </div>
            {result ? (
              <img src={result.url} alt="passport" className="passport-img" />
            ) : (
              <div className="empty">No result</div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 24,
            maxWidth: 400,
            width: '90%',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowPayment(false)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'none',
                border: 'none',
                fontSize: 20,
                cursor: 'pointer'
              }}
            >
              ×
            </button>

            <h2 style={{ marginTop: 0, color: '#333' }}>Buy Credits</h2>
            <p style={{ color: '#666', marginBottom: 20 }}>
              Choose your plan to start generating passport photos
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                border: '2px solid #007bff',
                borderRadius: 8,
                padding: 16,
                background: '#f8f9ff'
              }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#007bff' }}>Premium Subscription</h3>
                <p style={{ margin: '0 0 12px 0', color: '#666' }}>₹30 lifetime access - unlimited photos forever</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>₹30</span>
                  <button
                    style={{
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                    onClick={() => window.open('upi://pay?pa=your-upi-id@paytm&pn=Passport%20Photo%20App&am=30&cu=INR', '_blank')}
                  >
                    Pay with UPI
                  </button>
                </div>
              </div>

              <div style={{
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: 16
              }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>Photo Credits</h3>
                <p style={{ margin: '0 0 12px 0', color: '#666' }}>10 photos for one-time use</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>₹10</span>
                  <button
                    style={{
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                    onClick={() => window.open('upi://pay?pa=your-upi-id@paytm&pn=Passport%20Photo%20App&am=10&cu=INR', '_blank')}
                  >
                    Pay with UPI
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, padding: '12px', background: '#f8f9fa', borderRadius: 6 }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                <strong>Payment Instructions:</strong><br/>
                After payment, send screenshot to: support@passportphoto.com<br/>
                Credits will be added within 24 hours
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
