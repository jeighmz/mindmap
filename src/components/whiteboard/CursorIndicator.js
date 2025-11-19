import React from 'react';
import { getUserProfilePicture } from '../../utils/profilePicture';
import '../../styles/CursorIndicator.css';

const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
];

const getCursorColor = (userId, userEmail) => {
  // Generate a consistent color based on userId
  let hash = 0;
  const str = userId || userEmail || '';
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
};

const CursorIndicator = ({ collaborator, scale = 1, panOffset = { x: 0, y: 0 } }) => {
  if (!collaborator.cursorPosition) {
    return null;
  }

  const { x, y } = collaborator.cursorPosition;
  const cursorColor = collaborator.cursorColor || getCursorColor(collaborator.userId, collaborator.userEmail);

  // Transform coordinates to match canvas rendering
  // Items are rendered with: translate(panOffset) scale(scale * dpr)
  // So cursor needs: (x * scale * dpr) + panOffset.x
  const dpr = window.devicePixelRatio || 1;
  const effectiveScale = scale * dpr;
  const transformedX = (x * effectiveScale) + panOffset.x;
  const transformedY = (y * effectiveScale) + panOffset.y;

  return (
    <div
      className="cursor-indicator"
      style={{
        left: `${transformedX}px`,
        top: `${transformedY}px`,
        '--cursor-color': cursorColor
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={cursorColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="cursor-icon"
      >
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      </svg>
      <div className="cursor-label" style={{ backgroundColor: cursorColor }}>
        {collaborator.userName || collaborator.userEmail?.split('@')[0] || 'User'}
      </div>
    </div>
  );
};

export default CursorIndicator;

