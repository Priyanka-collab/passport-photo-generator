# Setup Guide - Segmind API Integration

## Quick Start

### 1. Environment Variables Setup

Create a `.env` file in the `passport-photo-generator` directory (copy from `.env.example`):

```bash
# Segmind API Configuration
SEGMIND_API_URL=https://api.segmind.com/v1/nano-banana
SEGMIND_API_KEY=your_api_key_here

# Google OAuth Configuration  
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Session Configuration
SESSION_SECRET=your_random_secret_here

# Node Environment
NODE_ENV=development
PORT=3001
```

### 2. Getting Segmind API Key

1. Go to [Segmind](https://segmind.com)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and paste it in your `.env` file as `SEGMIND_API_KEY`

### 3. Getting Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable the Google+ API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - `http://localhost:3001/auth/google/callback` (for development)
   - `https://your-domain.com/auth/google/callback` (for production)
6. Copy Client ID and Client Secret to `.env`

### 4. Running the Server

```bash
cd passport-photo-generator
npm install
npm start
```

The server will run on `http://localhost:3001`

## API Endpoint

### POST `/api/segmind`

**Authentication**: Required (Google OAuth session)

**Request Body**:
```json
{
  "model": "qwen-image-edit-plus",
  "init_images": ["base64_encoded_image"],
  "prompt": "professional passport photo transformation",
  "negative_prompt": "low quality, blurry, sunglasses",
  "width": 1200,
  "height": 1600
}
```

**Response**:
```json
{
  "images": ["data:image/png;base64,..."]
}
```

## Nano-Banana Model Details

- **Model**: `nano-banana`
- **Endpoint**: `https://api.segmind.com/v1/nano-banana`
- **Purpose**: Fast, efficient image generation and editing
- **Input Resolution**: Up to 1200x1600
- **Output**: PNG format (base64 encoded)
- **Processing Time**: ~10-30 seconds per image

## Troubleshooting

### Error: SEGMIND_API_KEY not set
- Ensure `.env` file exists in `passport-photo-generator` directory
- Verify `SEGMIND_API_KEY` is set correctly
- Restart the server after updating `.env`

### Error: Authentication required
- Make sure you're logged in with Google OAuth
- Check browser cookies are enabled
- Session might have expired - log out and log back in

### Error: SEGMIND_API_URL appears to be a model page
- Ensure you're using the API endpoint: `https://api.segmind.com/v1/nano-banana`
- NOT the model page: `https://www.segmind.com/models/...`

### Image generation takes too long
- The nano-banana model typically takes 10-30 seconds
- Check network connectivity
- Verify API key has sufficient credits

## Testing

To test the integration locally:

1. Start the server
2. Open `http://localhost:5173` (React app)
3. Navigate to "AI Passport Photo" section
4. Upload a test photo
5. Click "Generate Passport Photo"
6. Monitor console for logs

Check browser DevTools Console for detailed API call information.

## Production Deployment

For production deployment (e.g., Vercel):

1. Set environment variables in your hosting platform
2. Update `SEGMIND_API_URL` if using a different model endpoint
3. Ensure CORS origins are properly configured
4. Configure HTTPS redirect URIs for Google OAuth
5. Use a production-grade session store instead of in-memory storage

### Vercel Environment Variables
```
SEGMIND_API_URL=https://api.segmind.com/v1/nano-banana
SEGMIND_API_KEY=<your-key>
GOOGLE_CLIENT_ID=<your-id>
GOOGLE_CLIENT_SECRET=<your-secret>
SESSION_SECRET=<your-secret>
NODE_ENV=production
```
