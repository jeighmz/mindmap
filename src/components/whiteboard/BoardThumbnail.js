import React, { useEffect, useState } from 'react';
import { generateBoardThumbnail, getThumbnailCacheKey } from '../../utils/boardThumbnail';

const BoardThumbnail = ({ board, className = '', variant = 'card' }) => {
  const [thumbnailSrc, setThumbnailSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = getThumbnailCacheKey(board);
    const isList = variant === 'list';

    setIsLoading(true);
    setThumbnailSrc(null);

    generateBoardThumbnail(board, {
      width: isList ? 128 : 400,
      height: isList ? 128 : 225,
      padding: isList ? 10 : 20,
      cacheKey,
    })
      .then((url) => {
        if (!cancelled) {
          setThumbnailSrc(url);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setThumbnailSrc(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [board, variant]);

  return (
    <div className={`board-thumbnail ${className} board-thumbnail--${variant}${isLoading ? ' board-thumbnail--loading' : ''}`}>
      {thumbnailSrc ? (
        <img src={thumbnailSrc} alt="" className="board-thumbnail-image" draggable={false} />
      ) : (
        <div className="board-thumbnail-placeholder" aria-hidden="true" />
      )}
    </div>
  );
};

export default BoardThumbnail;
