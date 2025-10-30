# Passport Photo Generator (React + Vite)

This small app lets you pick a personal photo, detects the face using an open-source model (face-api.js), crops and aligns it to a passport-style size, shows a preview, and allows download.

## Authentication

The app now includes Google OAuth authentication. Users must sign in with Google to access the AI-powered photo enhancement features (via Segmind API).

## Free Deployment Options

### Option 1: Vercel (Recommended for React + Express)
1. **Frontend**: Deploy React app to Vercel
2. **Backend**: Deploy Express server to Vercel or Railway
3. **Database**: Use MongoDB Atlas (free tier)

### Option 2: Netlify + Railway
1. **Frontend**: Deploy to Netlify (free)
2. **Backend**: Deploy Express server to Railway (free tier available)
3. **Database**: Railway includes PostgreSQL free tier

### Option 3: Render
1. **Full Stack**: Deploy both frontend and backend to Render
2. **Database**: Render offers PostgreSQL free tier

## Detailed Vercel Deployment Guide

### Step 1: Prepare Your Project
```bash
# Make sure you're in the project root directory
cd c:\passport-photo

# Install dependencies
npm install

# Test locally first
npm run dev
# In another terminal: node server/index.js
```

### Step 2: Create Vercel Account
1. Go to [vercel.com](https://vercel.com) and sign up with GitHub/GitLab/Bitbucket
2. Connect your GitHub account (recommended for automatic deployments)

### Step 3: Install Vercel CLI
```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login
```

### Step 4: Push Code to GitHub

First, create a GitHub repository and push your code:

```bash
# Initialize Git (if not already done)
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit: Passport Photo Generator"

# Create GitHub repo (visit github.com and create new repository)
# Then add remote and push
git remote add origin https://github.com/yourusername/your-repo-name.git
git branch -M main
git push -u origin main
```

### Step 5: Connect Vercel to GitHub (Super Easy Method)

1. **Go to Vercel Dashboard**: Visit [vercel.com/dashboard](https://vercel.com/dashboard)

2. **Import Project**:
   - Click "Add New..." → "Project"
   - Click "Import Git Repository"
   - Connect your GitHub account (if not already connected)
   - Select your passport-photo repository

3. **Configure Project**:
   - **Framework Preset**: Select "Other" (since we have custom config)
   - **Root Directory**: Leave as `./` (root)
   - **Build and Output Settings**: Vercel will auto-detect from `vercel.json`

4. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes for deployment

### Step 6: Add Environment Variables

In your Vercel project dashboard:
1. Go to "Settings" → "Environment Variables"
2. Add these variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `SESSION_SECRET` (generate a random string)
   - `SEGMIND_API_KEY`
   - `SEGMIND_API_URL`

### Step 7: Update Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project → "APIs & Credentials" → "OAuth 2.0 Client IDs"
3. Add your Vercel domain to "Authorized redirect URIs":
   ```
   https://your-project-name.vercel.app/auth/google/callback
   ```

### Step 8: Redeploy

After adding environment variables and updating Google OAuth, Vercel will automatically redeploy.

## 🎉 That's It! Your app is now live!

**Your app URL**: `https://your-project-name.vercel.app`

## Future Deployments

- **Automatic**: Every time you push to the `main` branch, Vercel redeploys automatically
- **Preview**: Every pull request gets a preview deployment
- **Rollback**: Easy rollback to previous deployments from Vercel dashboard

## Vercel + GitHub Integration Benefits

- ✅ **Free** hosting with generous limits
- ✅ **Automatic deployments** on every git push
- ✅ **Preview deployments** for pull requests
- ✅ **Global CDN** for fast loading worldwide
- ✅ **SSL certificates** included
- ✅ **Custom domains** supported
- ✅ **Environment management** built-in

### Step 5: Update package.json Scripts
```json
{
  "scripts": {
    "build": "vite build",
    "start": "node server/index.js",
    "vercel-build": "npm run build"
  }
}
```

### Step 6: Deploy to Vercel
```bash
# Deploy (will ask questions interactively)
vercel

# For production deployment
vercel --prod
```

### Step 7: Configure Environment Variables
In your Vercel dashboard (vercel.com/dashboard):
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add these variables:
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SESSION_SECRET=your_secure_session_secret
SEGMIND_API_KEY=your_segmind_api_key
SEGMIND_API_URL=https://api.segmind.com/v1/qwen-image-edit-plus
```

### Step 8: Update Google OAuth Redirect URIs
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to your OAuth 2.0 Client ID
3. Add these redirect URIs:
```
https://your-project-name.vercel.app/auth/google/callback
```

### Step 9: Update Frontend API Calls
Update `src/App.jsx` to use relative URLs instead of localhost:
```javascript
// Change from:
fetch('http://localhost:3001/auth/user', { credentials: 'include' })

// To:
fetch('/auth/user', { credentials: 'include' })
```

### Step 10: Redeploy
```bash
# Redeploy with environment variables
vercel --prod
```

### Step 11: Access Your App
Your app will be live at: `https://your-project-name.vercel.app`

## Troubleshooting Vercel Deployment

### Common Issues:

1. **API Routes Not Working**:
   - Make sure `vercel.json` routes are correct
   - Check that API endpoints are properly configured

2. **Environment Variables**:
   - Ensure all required env vars are set in Vercel dashboard
   - Redeploy after adding env vars

3. **CORS Issues**:
   - Update CORS configuration in `server/index.js`:
   ```javascript
   app.use(cors({
     origin: process.env.NODE_ENV === 'production'
       ? 'https://your-project-name.vercel.app'
       : 'http://localhost:5173',
     credentials: true
   }))
   ```

4. **Session Issues**:
   - Make sure `SESSION_SECRET` is set and secure
   - Check that cookies are working in production

### Vercel-Specific Optimizations:

1. **Serverless Functions**: Your Express server runs as serverless functions
2. **Global CDN**: Automatic CDN for fast worldwide loading
3. **Auto HTTPS**: Automatic SSL certificates
4. **Preview Deployments**: Every git push creates a preview deployment

### Cost Information:
- **Free Tier**: 100GB bandwidth, 1000 serverless function invocations/month
- **Pro**: $20/month for higher limits
- **Excellent for MVPs and small apps**

### Using Netlify (Frontend) + Railway (Backend):
```bash
# Frontend: Install Netlify CLI
npm install -g netlify-cli
netlify login

# Build and deploy frontend
npm run build
netlify deploy --prod --dir=dist

# Backend: Deploy to Railway
# 1. Go to railway.app
# 2. Connect GitHub repo
# 3. Set environment variables
# 4. Deploy automatically
```

### Using Render (Full Stack):
```bash
# 1. Go to render.com
# 2. Create new Web Service
# 3. Connect GitHub repo
# 4. Set build command: npm run build && npm run start
# 5. Set environment variables
# 6. Deploy
```

## Environment Setup for Production

1. **Google OAuth**: Update authorized redirect URIs with your production domain
2. **UPI Integration**: Replace `your-upi-id@paytm` with your actual UPI ID in `src/App.jsx`
3. **Database**: Set up MongoDB Atlas or Railway PostgreSQL and update connection strings
4. **Environment Variables**: Configure production environment variables in your hosting platform

## Free Hosting Limits

- **Vercel**: 100GB bandwidth/month, generous hobby limits
- **Netlify**: 100GB bandwidth/month, 1000 build minutes/month
- **Railway**: $5/month credit, PostgreSQL included
- **Render**: 750 hours/month free, PostgreSQL free tier
- **MongoDB Atlas**: 512MB free storage

## Cost Summary

- **Development**: Completely FREE
- **Basic Hosting**: FREE (within limits)
- **Database**: FREE tiers available
- **AI API**: Pay-per-use (Segmind API)
- **Domain**: ~$10-15/year (optional)

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
