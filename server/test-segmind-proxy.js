const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')

async function run() {
  const proxy = 'http://localhost:3001/api/segmind'
  // tiny 1x1 PNG base64 (transparent)
  const tinyPngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII='
  const dataUri = 'data:image/png;base64,' + tinyPngB64
  console.log('-> Testing JSON payload')
  try {
    const j = { model: 'qwen-image-edit-plus', prompt: 'Test', init_images: [tinyPngB64], mask: null }
    const r = await axios.post(proxy, j, { headers: { 'Content-Type': 'application/json' }, timeout: 120000 })
    console.log('JSON resp status', r.status)
    console.log('JSON resp data', r.data)
  } catch (e) {
    console.error('JSON error', e.response ? e.response.status : e.message, e.response ? e.response.data : '')
  }

  console.log('\n-> Testing multipart/form-data payload')
  try {
    const form = new FormData()
    const imgBuf = Buffer.from(tinyPngB64, 'base64')
    form.append('image', imgBuf, { filename: 'init.png', contentType: 'image/png' })
    form.append('prompt', 'Test multipart')
    const r2 = await axios.post(proxy, form, { headers: form.getHeaders(), timeout: 120000 })
    console.log('Multipart resp status', r2.status)
    console.log('Multipart resp data', r2.data)
  } catch (e) {
    console.error('Multipart error', e.response ? e.response.status : e.message, e.response ? e.response.data : '')
  }
}

run().catch((e) => { console.error(e); process.exit(1) })
