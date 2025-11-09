// Utility function to get user profile picture URL
// If user uses SSO (like Google), use their profile image
// Otherwise, use a default image

const DEFAULT_AVATAR = '/default-avatar.png';

// Generate a simple SVG avatar as fallback
const generateDefaultAvatar = (name = 'User') => {
  const initial = name.charAt(0).toUpperCase();
  const colors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1'];
  const colorIndex = name.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];
  
  // Use URL encoding instead of base64 for better compatibility
  const svg = `<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="${bgColor}"/><text x="32" y="42" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">${initial}</text></svg>`;
  
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const getUserProfilePicture = (user) => {
  if (!user) {
    return DEFAULT_AVATAR;
  }

  // Check if user is using SSO
  // SSO providers include: 'google.com', 'facebook.com', 'twitter.com', 'github.com', etc.
  // Email/password is 'password' or 'email'
  const provider = user.provider || (user.providerData && user.providerData[0]?.providerId);
  const isSSO = provider && provider !== 'email' && provider !== 'password';
  
  // If SSO user and has a valid photoURL, use it
  if (isSSO && user.photoURL && user.photoURL.trim() !== '') {
    return user.photoURL;
  }
  
  // If not SSO or no photoURL, use default
  // The onError handler will catch if default-avatar.png fails to load
  return DEFAULT_AVATAR;
};

// Handle image load errors by providing a fallback
export const handleImageError = (e, user) => {
  // If the image fails to load, use a generated SVG avatar
  const name = user?.displayName || user?.email || 'User';
  e.target.src = generateDefaultAvatar(name);
  e.target.onerror = null; // Prevent infinite loop
};

