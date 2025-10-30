import * as faceapi from 'face-api.js'

// Load face-api models from CDN for simplicity. In production, host locally.
const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'

export async function loadModels() {
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
    console.log('face-api models loaded')
  } catch (err) {
    console.error('Failed to load models', err)
  }
}

// Call the local proxy which forwards to Segmind. Expects the proxy at /api/segmind
export async function callSegmind(imageSrc, { prompt = '', width = 1200, height = 1600, backgroundColor = '#ffffff', negativePrompt = '' } = {}) {
  // Prepare init image + mask (uses BodyPix if available)
  let initBase64, maskBase64
  try {
    const p = await prepareAiPayload(imageSrc, { backgroundColor })
    initBase64 = p.initBase64
    maskBase64 = p.maskBase64
  } catch (err) {
    // fallback: create a simple init image and an all-white mask
    const img = await loadImage(imageSrc)
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0)
    initBase64 = c.toDataURL('image/png').replace(/^data:image\/(png|jpeg);base64,/, '')
    const m = document.createElement('canvas')
    m.width = img.width
    m.height = img.height
    const mc = m.getContext('2d')
    mc.fillStyle = '#ffffff'
    mc.fillRect(0, 0, m.width, m.height)
    maskBase64 = m.toDataURL('image/png').replace(/^data:image\/(png|jpeg);base64,/, '')
  }

  // Strong default prompt to frontalize and professionalize the portrait
  if (!prompt) {
    prompt = `Convert the input into a professional, frontal, head-and-shoulders portrait. Preserve the subject's identity and facial features while rotating and frontalizing the head so the subject faces the camera with neutral expression. Replace clothing with professional attire (a dark blazer and collared shirt), ensure visible shoulders, remove distracting accessories, and render a clean white studio background. Photorealistic, high detail, natural skin tones, realistic shadows and studio lighting.`
  }

  // Build the inpainting/edit payload: many Segmind endpoints accept init_images + mask
  const initDataUri = 'data:image/png;base64,' + initBase64
  const maskDataUri = 'data:image/png;base64,' + maskBase64

  // include multiple common variants so the Segmind endpoint accepts at least one
  // Simpler: send multipart/form-data (image file + mask + prompt). The proxy will stream this to Segmind.
  const form = new FormData()
  const imgBytes = atob(initBase64)
  const imgLen = imgBytes.length
  const imgArr = new Uint8Array(imgLen)
  for (let i = 0; i < imgLen; i++) imgArr[i] = imgBytes.charCodeAt(i)
  const imgBlob = new Blob([imgArr], { type: 'image/png' })
  // Append the same file under multiple common field names so upstream accepts at least one
  form.append('image', imgBlob, 'init.png')
  form.append('init_image', imgBlob, 'init.png')
  form.append('init_images', imgBlob, 'init.png')
  form.append('init_images[]', imgBlob, 'init.png')
  form.append('file', imgBlob, 'init.png')
  // Only send the image and prompt — Segmind requires an image; mask is optional
  form.append('prompt', prompt)
  if (negativePrompt) form.append('negative_prompt', negativePrompt)
  // Append mask so the model can inpaint head/torso as needed (frontalization + attire change)
  try {
    const maskBytes = atob(maskBase64)
    const mLen = maskBytes.length
    const mArr = new Uint8Array(mLen)
    for (let i = 0; i < mLen; i++) mArr[i] = maskBytes.charCodeAt(i)
    const maskBlob = new Blob([mArr], { type: 'image/png' })
    // attach mask under several common names
    form.append('mask', maskBlob, 'mask.png')
    form.append('mask_image', maskBlob, 'mask.png')
    form.append('mask_data', maskBlob, 'mask.png')
  } catch (e) {
    // if mask preparation failed, continue without mask
    console.warn('Failed to append mask for Segmind request:', e)
  }
  form.append('width', String(width))
  form.append('height', String(height))

  console.debug('callSegmind posting multipart form to proxy', { width, height })

  const res = await fetch('/api/segmind', { method: 'POST', body: form })

  if (!res.ok) {
    // proxy may return JSON; try to parse it for clearer messages (handles Buffer-style detail)
    let parsed = null
    try {
      parsed = await res.json()
    } catch (e) {
      const text = await res.text()
      throw new Error('Segmind proxy error: ' + res.status + ' ' + text)
    }

    // If parsed contains a Buffer-like detail, decode it
    if (parsed && parsed.detail && parsed.detail.type === 'Buffer' && Array.isArray(parsed.detail.data)) {
      try {
        // Use TextDecoder to safely decode large byte arrays in the browser
        const decoder = new TextDecoder('utf-8')
        const u8 = new Uint8Array(parsed.detail.data)
        const txt = decoder.decode(u8)
        if (txt && /image/i.test(txt)) {
          throw new Error('Segmind proxy error: ' + res.status + ' ' + txt + ' — The request must include an image (base64 or data URI).')
        }
        throw new Error('Segmind proxy error: ' + res.status + ' ' + txt)
      } catch (e2) {
        // fallback: produce a short sanitized preview
        try {
          const arr = parsed.detail.data
          const preview = arr.slice(0, 200).map((n) => (n >= 32 && n <= 126 ? String.fromCharCode(n) : '?')).join('')
          throw new Error('Segmind proxy error: ' + res.status + ' (failed to decode detail). Preview: ' + preview)
        } catch (_) {
          throw new Error('Segmind proxy error: ' + res.status + ' (failed to decode detail)')
        }
      }
    }

    // If parsed.error exists
    if (parsed && parsed.error) {
      const info = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error)
      if (/prompt/i.test(info)) {
        throw new Error('Segmind proxy error: ' + res.status + ' ' + info + ' — The request must include a valid prompt string.')
      }
      if (/image/i.test(info)) {
        throw new Error('Segmind proxy error: ' + res.status + ' ' + info + ' — The request must include an image (base64 or data URI).')
      }
      throw new Error('Segmind proxy error: ' + res.status + ' ' + info)
    }

    throw new Error('Segmind proxy error: ' + res.status + ' ' + JSON.stringify(parsed))
  }

  const json = await res.json()
  // try to extract base64 from common fields
  function extract(obj) {
    if (!obj) return null
    if (typeof obj === 'string') return obj
    if (Array.isArray(obj)) {
      for (const it of obj) {
        const s = extract(it)
        if (s) return s
      }
    }
    if (typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        const s = extract(obj[k])
        if (s) return s
      }
    }
    return null
  }

  // Try to find a binary array inside a JSON object (e.g. bytes represented as number arrays)
  function findBinary(obj) {
    if (!obj) return null
    if (Array.isArray(obj)) {
      // heuristic: array of numbers 0-255 and reasonably long
      if (obj.length > 50 && obj.every((n) => typeof n === 'number' && n >= 0 && n <= 255)) {
        return new Uint8Array(obj)
      }
      for (const it of obj) {
        const b = findBinary(it)
        if (b) return b
      }
    }
    if (typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        const v = obj[k]
        // common envelope field names
        if (k === 'data' && Array.isArray(v) && v.length > 50 && v.every((n) => typeof n === 'number')) {
          return new Uint8Array(v)
        }
        const b = findBinary(v)
        if (b) return b
      }
    }
    return null
  }

  // Prefer common JSON fields first
  let found = null
  if (json) {
    if (json.images && Array.isArray(json.images) && json.images[0]) found = json.images[0]
    else if (json.outputs && Array.isArray(json.outputs) && json.outputs[0]) found = json.outputs[0]
    else if (json.data) found = json.data
  }

  if (!found) found = extract(json) || null

  // If still not found, try to locate raw binary arrays in the JSON
  if (!found) {
    const bin = findBinary(json)
    if (bin) {
      return new Blob([bin.buffer], { type: 'image/png' })
    }
  }

  if (!found) throw new Error('No image returned from Segmind proxy')

  // If extract returned a non-string, try to stringify and search again
  if (typeof found !== 'string') {
    try {
      const s = JSON.stringify(found)
      const m = s.match(/data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\-_\n\r]+)/)
      if (m) found = m[0]
      else found = s
    } catch (e) {
      found = String(found)
    }
  }

  // match a data URI or raw base64
  const match = found.match(/data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\-_\n\r]+)/)
  let b64str = null
  if (match) {
    b64str = match[2]
  } else {
    // attempt to find a base64-like substring
    const m2 = found.match(/([A-Za-z0-9+/=\-_\n\r]{100,})/)
    b64str = m2 ? m2[1] : found
  }

  // sanitize base64: remove whitespace/newlines and convert base64url to base64
  b64str = b64str.replace(/\s+/g, '')
  b64str = b64str.replace(/-/g, '+').replace(/_/g, '/')
  // pad if necessary
  const mod = b64str.length % 4
  if (mod === 2) b64str += '=='
  else if (mod === 3) b64str += '='
  else if (mod === 1) throw new Error('Invalid base64 string length from Segmind')
  // Validate that b64str looks like base64 (only base64 chars)
  const base64Only = /^[A-Za-z0-9+/=]+$/.test(b64str)
  if (!base64Only) {
    // show a short sanitized preview to help debugging (don't log huge blobs)
    const preview = b64str.slice(0, 200).replace(/[^ -~]+/g, '?')
    console.error('Segmind returned non-base64 content. Preview:', preview)
    throw new Error('Segmind returned non-base64 content. Check the proxy/upstream response. Preview: ' + preview)
  }

  const dataUri = 'data:image/png;base64,' + b64str

  // Convert returned image (data URI or base64 or binary array) to Blob as before
  // The rest of the function handles extracting/decoding and returns a Blob
  try {
    // Convert base64 string to Uint8Array and return a Blob
    const binStr = atob(b64str)
    const len = binStr.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i)
    return new Blob([bytes.buffer], { type: 'image/png' })
  } catch (e) {
    throw e
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Composite the subject onto a solid background color using BodyPix segmentation,
// then detect the face on the composited image and crop/align normally.
export async function generatePassportPhoto(imageSrc, { width = 600, height = 800, backgroundColor = '#ffffff' } = {}) {
  const img = await loadImage(imageSrc)

  // draw the source image onto a composited canvas (with background color)
  const composedCanvas = document.createElement('canvas')
  composedCanvas.width = img.width
  composedCanvas.height = img.height
  const compCtx = composedCanvas.getContext('2d')
  compCtx.fillStyle = backgroundColor
  compCtx.fillRect(0, 0, composedCanvas.width, composedCanvas.height)
  compCtx.drawImage(img, 0, 0)

  // Use composited canvas as source for face detection
  const composedImg = new Image()
  composedImg.src = composedCanvas.toDataURL('image/png')
  await new Promise((res, rej) => {
    composedImg.onload = res
    composedImg.onerror = rej
  })

  const detection = await faceapi.detectSingleFace(composedImg).withFaceLandmarks()
  if (!detection) throw new Error('No face detected')

  const box = detection.detection.box
  const landmarks = detection.landmarks

  // compute crop box: enlarge bounding box with margin
  const margin = 0.6 // percentage of face size to include around
  const faceW = box.width
  const faceH = box.height
  const cx = box.x + faceW / 2
  const cy = box.y + faceH / 2

  const cropW = faceW * (1 + margin)
  const cropH = faceH * (1 + margin * 1.4) // more vertical space

  let sx = Math.max(0, cx - cropW / 2)
  let sy = Math.max(0, cy - cropH / 2)
  let sW = Math.min(composedImg.width - sx, cropW)
  let sH = Math.min(composedImg.height - sy, cropH)

  // create final canvas and draw cropped face
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  // Fill with chosen background color (in case of empty areas)
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, width, height)

  // compute destination rectangle to center face
  const desiredFaceHeight = height * 0.5
  const scale = desiredFaceHeight / sH
  const dW = sW * scale
  const dH = sH * scale
  const dx = (width - dW) / 2
  const eyePositions = landmarks.getLeftEye().concat(landmarks.getRightEye())
  const eyesY = eyePositions.reduce((sum, p) => sum + p.y, 0) / eyePositions.length
  const eyeRatio = (eyesY - sy) / sH // relative position of eyes in crop
  const desiredEyesY = height * 0.35
  const dy = desiredEyesY - eyeRatio * dH

  ctx.drawImage(composedImg, sx, sy, sW, sH, dx, dy, dW, dH)

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// Prepare init image and mask as base64 strings for external AI inpainting
export async function prepareAiPayload(imageSrc, { backgroundColor = '#ffffff' } = {}) {
  const img = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')

  // Fill with bg color
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  let maskCanvas = document.createElement('canvas')
  maskCanvas.width = img.width
  maskCanvas.height = img.height
  const maskCtx = maskCanvas.getContext('2d')

  if (bodyPixModel) {
    try {
      const segmentation = await bodyPixModel.segmentPerson(img, { internalResolution: 'medium', segmentationThreshold: 0.7 })
      // draw source image on temp
      const off = document.createElement('canvas')
      off.width = img.width
      off.height = img.height
      const offCtx = off.getContext('2d')
      offCtx.drawImage(img, 0, 0)
      const srcData = offCtx.getImageData(0, 0, off.width, off.height)

      const outImgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const outMaskData = maskCtx.createImageData(maskCanvas.width, maskCanvas.height)

      for (let i = 0; i < segmentation.data.length; i++) {
        if (segmentation.data[i] === 1) {
          outImgData.data[i * 4 + 0] = srcData.data[i * 4 + 0]
          outImgData.data[i * 4 + 1] = srcData.data[i * 4 + 1]
          outImgData.data[i * 4 + 2] = srcData.data[i * 4 + 2]
          outImgData.data[i * 4 + 3] = srcData.data[i * 4 + 3]

          // mask: white where person is
          outMaskData.data[i * 4 + 0] = 255
          outMaskData.data[i * 4 + 1] = 255
          outMaskData.data[i * 4 + 2] = 255
          outMaskData.data[i * 4 + 3] = 255
        } else {
          // transparent in mask
          outMaskData.data[i * 4 + 0] = 0
          outMaskData.data[i * 4 + 1] = 0
          outMaskData.data[i * 4 + 2] = 0
          outMaskData.data[i * 4 + 3] = 255
        }
      }

      ctx.putImageData(outImgData, 0, 0)
      maskCtx.putImageData(outMaskData, 0, 0)
    } catch (err) {
      // fallback: draw full image and a full-white mask
      ctx.drawImage(img, 0, 0)
      maskCtx.fillStyle = '#ffffff'
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
    }
  } else {
    ctx.drawImage(img, 0, 0)
    maskCtx.fillStyle = '#ffffff'
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
  }

  const initBase64 = canvas.toDataURL('image/png').replace(/^data:image\/(png|jpeg);base64,/, '')
  const maskBase64 = maskCanvas.toDataURL('image/png').replace(/^data:image\/(png|jpeg);base64,/, '')
  return { initBase64, maskBase64 }
}

// Call external AI endpoint (user-provided) to professionalize image by inpainting.
// The API is expected to accept a JSON body with fields:
// { init_images: [base64str], mask: base64str, prompt: string, negative_prompt?: string, width, height }
// and return JSON { images: [base64str] }
export async function callAiEndpoint({ initBase64, maskBase64, apiUrl, prompt = 'professional studio portrait, neutral background, high quality', negativePrompt = '', width = 600, height = 800 }) {
  if (!apiUrl) throw new Error('No API URL provided')
  const payload = {
    init_images: [initBase64],
    mask: maskBase64,
    prompt,
    negative_prompt: negativePrompt,
    width,
    height,
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error('AI API error: ' + res.status + ' ' + text)
  }

  const json = await res.json()
  if (!json || !json.images || !json.images[0]) throw new Error('Invalid AI response')
  const b64 = json.images[0]
  // convert base64 to blob
  const bin = atob(b64)
  const len = bin.length
  const arr = new Uint8Array(len)
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i)
  const blob = new Blob([arr], { type: 'image/png' })
  return blob
}
