#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

// Load .env if present, otherwise fall back to parsing .env.example so users who
// accidentally put keys there are still supported.
dotenv.config()
if (!process.env.SEGMIND_API_KEY) {
  const examplePath = path.resolve(process.cwd(), '.env.example')
  if (fs.existsSync(examplePath)) {
    try {
      const contents = fs.readFileSync(examplePath, 'utf8')
      for (const line of contents.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
        if (m) {
          const k = m[1]
          let v = m[2]
          // strip optional quotes
          if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1)
          }
          if (v && !process.env[k]) process.env[k] = v
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }
}
const axios = require('axios')

function usage() {
  console.log('Usage: node scripts/generate-segmind.js --input input.jpg --out out.png [--prompt "..."] [--width 600] [--height 800]')
  process.exit(1)
}

const argv = require('minimist')(process.argv.slice(2))
const input = argv.input || argv.i
const out = argv.out || argv.o || 'out.png'
const attire = (argv.attire || argv.a || '').toLowerCase()
let prompt = argv.prompt || argv.p || ''
if (!prompt) {
  // Build a strong default prompt that asks the model to reconstruct a full professional head-and-shoulders portrait
  if (attire === 'tux' || attire === 'tuxedo' || attire === 'male') {
    prompt = 'Convert the input into a professional head-and-shoulders portrait. Preserve the subject identity and facial features. Replace clothing with a classic black tuxedo, crisp white shirt and black bow tie. Use neutral studio lighting, clean neutral background, photorealistic, high detail.'
  } else if (attire === 'female' || attire === 'woman' || attire === 'female-professional') {
    prompt = 'Convert the input into a professional head-and-shoulders portrait. Preserve the subject identity and facial features. Dress the subject in a formal blazer and blouse appropriate for passport photos. Use neutral studio lighting, clean neutral background, photorealistic, high detail.'
  } else if (attire === 'business') {
    prompt = 'Convert the input into a professional head-and-shoulders portrait. Preserve the subject identity and facial features. Dress the subject in business attire (blazer and shirt). Use neutral studio lighting, clean neutral background, photorealistic, high detail.'
  } else {
    prompt = 'Convert the input into a professional head-and-shoulders portrait. Preserve the subject identity and facial features. Use neutral studio lighting, clean neutral background, photorealistic, high detail.'
  }
}

const width = parseInt(argv.width || argv.w || '600', 10)
const height = parseInt(argv.height || argv.h || '800', 10)

if (!input) usage()
if (!process.env.SEGMIND_API_KEY) {
  console.error('SEGMIND_API_KEY not set in environment or .env')
  process.exit(1)
}

async function main() {
  const absInput = path.resolve(input)
  if (!fs.existsSync(absInput)) {
    console.error('Input file not found:', absInput)
    process.exit(1)
  }

  const buf = fs.readFileSync(absInput)
  const b64 = buf.toString('base64')

  // Default to the Segmind model page URL per user request; override with SEGMIND_API_URL if you have the proper API endpoint.
  const apiUrl = process.env.SEGMIND_API_URL || 'https://www.segmind.com/models/qwen-image-edit-plus'

  const payload = {
    model: 'qwen-image-edit-plus',
    inputs: {
      image: b64,
      prompt,
      width,
      height,
    },
  }

  console.log('Calling Segmind API...', apiUrl)
  // helper: do request with retries
  async function postWithRetries(url, body, headers, attempts = 3) {
    let attempt = 0
    let lastErr = null
    while (attempt < attempts) {
      try {
        const r = await axios.post(url, body, { headers, timeout: 120000 })
        return r
      } catch (err) {
        lastErr = err
        attempt++
        const wait = 1000 * Math.pow(2, attempt)
        console.warn(`Segmind attempt ${attempt} failed, retrying in ${wait}ms...`)
        await new Promise((res) => setTimeout(res, wait))
      }
    }
    throw lastErr
  }

  try {
    const r = await postWithRetries(apiUrl, payload, { Authorization: `Bearer ${process.env.SEGMIND_API_KEY}` }, 3)
    const data = r.data || {}
    // Attempt to find base64 image in common fields
    let found = null
    const candidates = []
    if (Array.isArray(data.outputs)) candidates.push(...data.outputs)
    if (Array.isArray(data.images)) candidates.push(...data.images)
    if (data.data) candidates.push(data.data)

    // Flatten strings
    function extractBase64(obj) {
      if (!obj) return null
      if (typeof obj === 'string') return obj
      if (Array.isArray(obj)) {
        for (const it of obj) {
          const s = extractBase64(it)
          if (s) return s
        }
      }
      if (typeof obj === 'object') {
        for (const k of Object.keys(obj)) {
          const s = extractBase64(obj[k])
          if (s) return s
        }
      }
      return null
    }

    found = extractBase64(data)

    if (!found) {
      console.error('No base64 image found in Segmind response. Response keys:', Object.keys(data))
      console.error('Full response:', JSON.stringify(data).slice(0, 2000))
      process.exit(1)
    }

    // If found string contains data URI prefix, strip it
    const match = found.match(/data:image\/(png|jpeg);base64,(.*)/)
    const b64str = match ? match[2] : found
    const outBuf = Buffer.from(b64str, 'base64')
    fs.writeFileSync(out, outBuf)
    console.log('Saved generated image to', out)
  } catch (err) {
    console.error('Segmind call failed after retries:', err?.response?.data || err.message || err)
    // Attempt fallback to WEBUI_API_URL if provided
    if (process.env.WEBUI_API_URL) {
      console.log('Attempting fallback to WEBUI API at', process.env.WEBUI_API_URL)
      try {
        const fbPayload = {
          init_images: [b64],
          prompt,
          width,
          height,
        }
        const r2 = await postWithRetries(process.env.WEBUI_API_URL, fbPayload, {}, 2)
        const data2 = r2.data || {}
        const found2 = extractBase64(data2)
        if (!found2) {
          console.error('Fallback WEBUI did not return an image')
          process.exit(1)
        }
        const match2 = found2.match(/data:image\/(png|jpeg);base64,(.*)/)
        const b64str2 = match2 ? match2[2] : found2
        const outBuf2 = Buffer.from(b64str2, 'base64')
        fs.writeFileSync(out, outBuf2)
        console.log('Saved generated image to', out, '(from fallback)')
        process.exit(0)
      } catch (err2) {
        console.error('Fallback to WEBUI failed:', err2?.response?.data || err2.message || err2)
      }
    }

    process.exit(1)
  }
}

main()
