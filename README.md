# Mindmap Application

[![Netlify Status](https://api.netlify.com/api/v1/badges/your-netlify-app-id/deploy-status)](https://app.netlify.com/sites/your-netlify-app-name/deploys)

A collaborative mind mapping application built with React, Firebase, and more.

## Features

- Create and edit mind maps with a visual whiteboard
- Save personal boards to your account
- Demo boards available without login
- Collaborate and share mind maps
- Real-time updates

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

## Security Notes

- The `.env` file contains sensitive API keys and should not be committed to version control
- Firebase security rules are configured to protect user data
- Environment variables must be set in your Netlify deployment settings
