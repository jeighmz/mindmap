import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc, updateDoc, doc, getDoc, where } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase-config';
import { useAuth } from '../contexts/AuthContext';
import html2canvas from 'html2canvas';
import './Community.css';

const Community = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const [userBoards, setUserBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [shareTitle, setShareTitle] = useState('');
  const [shareDescription, setShareDescription] = useState('');

  useEffect(() => {
    fetchPosts();
    if (user) {
      fetchUserBoards();
    }
  }, [user]);

  const fetchPosts = async () => {
    try {
      const postsQuery = query(
        collection(db, 'communityPosts'),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(postsQuery);
      
      const postsData = [];
      for (const postDoc of querySnapshot.docs) {
        const post = postDoc.data();
        // Fetch user data for each post
        const userDoc = await getDoc(doc(db, 'userSettings', post.userId));
        const userData = userDoc.data() || {};
        
        postsData.push({
          id: postDoc.id,
          ...post,
          userName: userData.displayName || 'Anonymous',
          userAvatar: userData.photoURL || '/default-avatar.png'
        });
      }
      
      setPosts(postsData);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('Failed to load community posts');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserBoards = async () => {
    try {
      const boardsQuery = query(
        collection(db, 'boards'),
        where('userId', '==', user.uid)
      );
      const querySnapshot = await getDocs(boardsQuery);
      const boards = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserBoards(boards);
    } catch (err) {
      console.error('Error fetching user boards:', err);
    }
  };

  const capturePreview = async (boardId) => {
    try {
      const boardElement = document.querySelector(`#board-${boardId}`);
      if (!boardElement) {
        console.error('Board element not found');
        return null;
      }
      
      const canvas = await html2canvas(boardElement);
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Error capturing preview:', err);
      return null;
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    if (!selectedBoard || !shareTitle) {
      return;
    }

    try {
      // Capture the preview image
      const previewImage = await capturePreview(selectedBoard);
      
      // Upload preview to Firebase Storage if we have one
      let previewUrl = null;
      if (previewImage) {
        const storage = getStorage();
        const previewRef = ref(storage, `previews/${selectedBoard}_${Date.now()}.png`);
        await uploadString(previewRef, previewImage, 'data_url');
        previewUrl = await getDownloadURL(previewRef);
      }

      const post = {
        userId: user.uid,
        boardId: selectedBoard,
        title: shareTitle,
        description: shareDescription,
        createdAt: new Date().toISOString(),
        likes: 0,
        comments: [],
        previewUrl // Add the preview URL to the post
      };

      await addDoc(collection(db, 'communityPosts'), post);
      setShareTitle('');
      setShareDescription('');
      setSelectedBoard(null);
      fetchPosts(); // Refresh the posts
    } catch (err) {
      console.error('Error sharing board:', err);
      setError('Failed to share board');
    }
  };

  const handleLike = async (postId) => {
    if (!user) return;

    try {
      const postRef = doc(db, 'communityPosts', postId);
      const postDoc = await getDoc(postRef);
      const currentLikes = postDoc.data().likes || 0;
      
      await updateDoc(postRef, {
        likes: currentLikes + 1
      });

      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, likes: (post.likes || 0) + 1 }
          : post
      ));
    } catch (err) {
      console.error('Error liking post:', err);
    }
  };

  if (loading) {
    return <div className="community-loading">Loading community posts...</div>;
  }

  if (error) {
    return <div className="community-error">{error}</div>;
  }

  return (
    <div className="community-container">
      <div className="community-header">
        <h1>Community Mind Maps</h1>
        <p>Explore and share mind maps with the community</p>
      </div>

      {user && (
        <div className="share-board-section">
          <h2>Share Your Mind Map</h2>
          <form onSubmit={handleShare} className="share-form">
            <select 
              value={selectedBoard || ''} 
              onChange={(e) => setSelectedBoard(e.target.value)}
              required
            >
              <option value="">Select a mind map to share</option>
              {userBoards.map(board => (
                <option key={board.id} value={board.id}>
                  {board.name || 'Untitled Board'}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Give your share a title"
              value={shareTitle}
              onChange={(e) => setShareTitle(e.target.value)}
              required
            />

            <textarea
              placeholder="Add a description (optional)"
              value={shareDescription}
              onChange={(e) => setShareDescription(e.target.value)}
              rows={3}
            />

            <button type="submit" className="share-button">
              Share with Community
            </button>
          </form>
        </div>
      )}

      <div className="posts-container">
        {posts.map(post => (
          <div key={post.id} className="post-card">
            <div className="post-header">
              <img 
                src={post.userAvatar} 
                alt={post.userName}
                className="user-avatar"
              />
              <div className="post-meta">
                <h3>{post.title}</h3>
                <span className="post-author">
                  Shared by {post.userName} • {new Date(post.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {post.description && (
              <p className="post-description">{post.description}</p>
            )}

            <div className="post-preview">
              {post.previewUrl ? (
                <img 
                  src={post.previewUrl} 
                  alt={`Preview of ${post.title}`}
                  className="mind-map-preview"
                />
              ) : (
                <div className="preview-placeholder">
                  Preview not available
                </div>
              )}
            </div>

            <div className="post-actions">
              <button 
                className="like-button"
                onClick={() => handleLike(post.id)}
                disabled={!user}
              >
                👍 {post.likes || 0}
              </button>
              <button 
                className="view-button"
                onClick={() => window.location.href = `/board/${post.boardId}`}
              >
                View Mind Map
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Community; 