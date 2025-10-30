import React, { useRef, useState, useEffect } from 'react'
import { generatePassportPhoto, loadModels, callSegmind } from './passportHelper'

export default function App() {
  const [src, setSrc] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [userPrompt, setUserPrompt] = useState('')
  const fileRef = useRef()

  useEffect(() => {
    loadModels()
    // cleanup on unmount: revoke object URLs
    return () => {
      if (src) URL.revokeObjectURL(src)
      if (result?.url) URL.revokeObjectURL(result.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        const aiBlob = await callSegmind(src, { prompt: userPrompt || 'professional studio portrait, neutral background, high quality', width: 1200, height: 1600 })
        intermediateUrl = URL.createObjectURL(aiBlob)
      } catch (aiErr) {
        console.warn('Segmind call failed, falling back to local crop:', aiErr)
      }

  const inputForCrop = intermediateUrl || src
  const blob = await generatePassportPhoto(inputForCrop, { width: 600, height: 800, backgroundColor: bgColor })
  // Flatten the blob onto a canvas with the selected background color so the downloaded
  // file is a single image (no transparent areas or external white slide)
  const flattened = await flattenBlob(blob, bgColor, 600, 800)
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
        <h1>Passport Photo Generator</h1>
        <div className="controls">
          <input type="file" accept="image/*" onChange={onFile} ref={fileRef} />
          <div style={{ marginTop: 8 }}>
            <label style={{ color: 'rgba(255,255,255,0.8)', display: 'block', marginBottom: 6 }}>AI prompt (optional)</label>
            <textarea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} placeholder="e.g. Frontalize the face, replace with dark blazer and collared shirt, white background" rows={3} style={{ width: '100%', borderRadius:8, padding:8 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ color: 'rgba(255,255,255,0.8)', fontWeight:600 }}>Background</label>
            <select value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ padding:8, borderRadius:8 }}>
              <option value="#ffffff">White</option>
              <option value="#e6eef6">Light Blue</option>
              <option value="#cfe8d6">Soft Green</option>
              <option value="#f7f3ea">Cream</option>
              <option value="#dbeafe">Sky Blue</option>
            </select>
          </div>

          {/* AI professionalize feature removed */}
          <div className="button-group">
            <button className="primary" onClick={onGenerate} disabled={!src || loading}>
              {loading ? 'Generating...' : 'Generate Passport Photo'}
            </button>
            <button className="secondary" onClick={onDownload} disabled={!result}>
              Download
            </button>
            <button className="tertiary" onClick={onClear} disabled={!src && !result}>
              Clear
            </button>
          </div>
        </div>

        <div className="preview-row">
          <div className="preview-col">
            <h3>Original</h3>
            {src ? <img src={src} alt="original" className="preview-img" /> : <div className="empty">No image</div>}
          </div>

          <div className="preview-col">
            <h3>Passport</h3>
            {result ? <img src={result.url} alt="passport" className="passport-img" /> : <div className="empty">No result</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
