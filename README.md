# Passport Photo Generator (React + Vite)

This small app lets you pick a personal photo, detects the face using an open-source model (face-api.js), crops and aligns it to a passport-style size, shows a preview, and allows download.

Quick start (Windows PowerShell):

```powershell
cd c:\passport-photo
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

Notes:
- The project uses `face-api.js` and loads models from a public GitHub CDN. For reliability, download the `weights` folder and serve it from your own server or `public/` directory, then update `MODEL_URL` in `src/passportHelper.js`.
- Passport sizing: default output is 600x800 px (3:4). Adjust in the UI or code as needed.

Files of interest:
- `src/passportHelper.js` — detection, cropping and image composition logic
- `src/App.jsx` — UI and wiring
