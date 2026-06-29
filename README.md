# Mindmap Application

[![Netlify Status](https://api.netlify.com/api/v1/badges/1786ef42-14c3-4964-9306-b98d4714ad65/deploy-status)](https://app.netlify.com/projects/aimindmap/deploys)

An AI-powered mind mapping tool built with React and Firebase.

**[Live Demo → aimindmap.netlify.app](https://aimindmap.netlify.app)**

## Features

- **Visual whiteboard canvas** — drag-and-drop nodes, connectors, images, and charts
- **AI-generated mind maps** — describe a topic and generate a full mind map instantly (Groq / Llama 3.3 70B)
- **AI Expand tool** — select any node and expand it into related sub-concepts with one click
- **AI analysis chat panel** — chat with an AI about the content of your current board
- **Board sharing & collaboration** — share boards with other users by email, with viewer or editor permissions
- **Community boards** — browse and publish boards to a public community gallery
- **Subscription tiers** — Free, Starter, Pro, and Creator AI plans managed via Stripe
- **Firebase auth** — sign in with email/password or Google
- **Encrypted chat history** — AI conversation history is encrypted at rest per-user
- **Netlify Functions** — all third-party API calls (Groq, Stripe) are proxied server-side

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, React Router |
| Database & Auth | Firebase (Firestore, Authentication, Storage) |
| Serverless Functions | Netlify Functions (Node 20) |
| AI | Groq API — Llama 3.3 70B Versatile |
| Payments | Stripe (Checkout, Customer Portal, Webhooks) |
| Hosting | Netlify |

## Local Development

1. Clone the repository
2. Install dependencies
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with your configuration (see `.env.example`)
4. Start the development server
   ```
   npm start
   ```

## Deployment to Netlify

### Option 1: Connect to GitHub

1. Push your code to a GitHub repository
2. Log in to your Netlify account
3. Click "New site from Git"
4. Select your repository
5. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `build`
6. Add environment variables in the Netlify UI:
   - Go to Site Settings > Build & Deploy > Environment
   - Add all the environment variables from your `.env` file

### Option 2: Manual Deploy

1. Build your project locally
   ```
   npm run build
   ```
2. Drag and drop the `build` folder to Netlify's manual deploy area
3. Configure environment variables in the Netlify UI

## Firebase Configuration

This app requires Firebase for authentication and data storage. Make sure to:

1. Create a Firebase project at [firebase.google.com](https://firebase.google.com)
2. Enable Authentication (Email/Password and Google)
3. Set up Firestore Database
4. Add your web app to the Firebase project to get configuration values
5. Update Firestore security rules to match the rules in `firestore.rules`

## Documentation

- [Deployment (Netlify)](docs/DEPLOYMENT.md) — build settings, functions, env vars
- [Stripe Setup](docs/STRIPE.md) — keys, product IDs, webhooks (local & production)
- [Troubleshooting](docs/TROUBLESHOOTING.md) — common build/deploy/checkout issues
- [Sharing & Collaboration Plan](docs/SHARING_COLLABORATION_PLAN.md) — design doc (partially implemented)

## Security Notes

- The `.env` file contains sensitive API keys and should not be committed to version control
- Firebase security rules are configured to protect user data
- Environment variables must be set in your Netlify deployment settings
