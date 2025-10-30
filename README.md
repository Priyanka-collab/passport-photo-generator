# Passport Photo Generator (React + Vite)

This small app lets you pick a personal photo, detects the face using an open-source model (face-api.js), crops and aligns it to a passport-style size, shows a preview, and allows download.

## Authentication

The app now includes Google OAuth authentication. Users must sign in with Google to access the AI-powered photo enhancement features (via Segmind API).

## Pricing

- **Premium Subscription**: ₹30 lifetime access - unlimited photos forever
- **Photo Credits**: ₹10 for 10 individual photos (each photo costs ₹10)

## Database Setup

For production, you'll need to store user credits and subscription data. Here's a recommended approach:

1. **Database Schema** (MongoDB/PostgreSQL):
   ```javascript
   // User model
   {
     googleId: String,
     email: String,
     name: String,
     credits: Number, // default: 0
     hasSubscription: Boolean, // default: false
     subscriptionDate: Date,
     createdAt: Date
   }
   ```

2. **Database Integration**:
   - Replace the mock credit system with actual database queries
   - Use MongoDB (mongoose) or PostgreSQL for data persistence
   - Add proper error handling and transaction management

3. **Payment Verification**:
   - Implement payment confirmation endpoints
   - Update user credits/subscription status after successful payment
   - Send confirmation emails to users

4. **Environment Variables**:
   - Add `MONGODB_URI` or database connection string
   - Configure database credentials in `.env`

Quick start (Windows PowerShell):

```powershell
cd c:\passport-photo
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Setup

1. **Google OAuth Setup:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add your domain (`http://localhost:3001`) to authorized origins
   - Add callback URL (`http://localhost:3001/auth/google/callback`) to authorized redirect URIs
   - Copy Client ID and Client Secret to your `.env` file

2. **Environment Variables:**
   - Copy `.env.example` to `.env`
   - Fill in your `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `SESSION_SECRET`
   - Ensure `SEGMIND_API_KEY` is set for AI features

3. **Start the servers:**
   ```powershell
   # Terminal 1: Start the backend server
   node server/index.js

   # Terminal 2: Start the frontend dev server
   npm run dev
   ```

Notes:
- The project uses `face-api.js` and loads models from a public GitHub CDN. For reliability, download the `weights` folder and serve it from your own server or `public/` directory, then update `MODEL_URL` in `src/passportHelper.js`.
- Passport sizing: default output is 600x800 px (3:4). Adjust in the UI or code as needed.
- AI photo enhancement (via Segmind) requires authentication for API access control.

Files of interest:
- `src/passportHelper.js` — detection, cropping and image composition logic
- `src/App.jsx` — UI and authentication handling
- `server/index.js` — backend API and Google OAuth implementation
