import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase-config';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Upload a board image to Firebase Storage under boardImages/{uid}/...
 * Returns a Firestore-safe payload: short download URL + storage path (no data URLs).
 */
export async function uploadBoardImage({ file, dataUrl, userId, originalName }) {
  if (!userId) {
    throw new Error('Sign in to upload images');
  }
  if (!storage) {
    throw new Error('Firebase Storage is not initialized');
  }

  const safeName = String(originalName || `image-${Date.now()}.png`)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
  const storagePath = `boardImages/${userId}/${Date.now()}_${safeName}`;
  const imageRef = ref(storage, storagePath);

  if (file) {
    if (!file.type?.startsWith('image/')) {
      throw new Error('Only image files can be uploaded');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error('Image must be smaller than 10MB');
    }
    await uploadBytes(imageRef, file, {
      contentType: file.type || 'image/png',
      customMetadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        originalName: safeName,
      },
    });
  } else if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
    // Rough size check for base64 payloads (~3/4 of string length)
    if (dataUrl.length * 0.75 > MAX_IMAGE_BYTES) {
      throw new Error('Image must be smaller than 10MB');
    }
    await uploadString(imageRef, dataUrl, 'data_url', {
      contentType: dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/png',
      customMetadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        originalName: safeName,
      },
    });
  } else {
    throw new Error('No image file or data URL provided');
  }

  const imageUrl = await getDownloadURL(imageRef);
  return {
    imageUrl,
    storageRef: storagePath,
  };
}

/**
 * Ensure an image item is safe to persist in Firestore.
 * Uploads any remaining data URLs, then returns only serializable fields
 * (never embed multi-MB data URLs in the board document).
 */
export async function prepareImageItemForSave(item, userId) {
  if (!item || item.type !== 'image') {
    return item;
  }

  let imageUrl = item.imageUrl || '';
  let storagePath = item.storageRef || null;

  if ((!storagePath || imageUrl.startsWith('data:')) && imageUrl.startsWith('data:') && userId) {
    const uploaded = await uploadBoardImage({
      dataUrl: imageUrl,
      userId,
      originalName: `board-image-${item.id || Date.now()}.png`,
    });
    imageUrl = uploaded.imageUrl;
    storagePath = uploaded.storageRef;
  }

  // Prefer storage-backed download URLs; never persist data URLs once uploaded
  if (storagePath && typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
    try {
      imageUrl = await getDownloadURL(ref(storage, storagePath));
    } catch (error) {
      throw new Error(`Failed to resolve stored image: ${error.message}`);
    }
  }

  if (!storagePath && (!imageUrl || imageUrl.startsWith('data:'))) {
    throw new Error(
      'Image could not be saved: upload to storage failed or user is not signed in'
    );
  }

  const cleaned = {
    id: item.id,
    type: 'image',
    position: {
      x: Number(item.position?.x || 0),
      y: Number(item.position?.y || 0),
    },
    width: Number(item.width || 400),
    height: Number(item.height || 300),
    order: item.order !== undefined ? Number(item.order) : undefined,
  };

  if (storagePath) {
    cleaned.storageRef = String(storagePath);
  }
  if (imageUrl && !String(imageUrl).startsWith('data:')) {
    cleaned.imageUrl = String(imageUrl);
  }
  if (item.rotation !== undefined) {
    cleaned.rotation = Number(item.rotation) || 0;
  }

  // Drop runtime-only fields that can cause "invalid nested entity" errors
  // (errorDetails, HTMLImageElement refs, File objects, etc.)
  return cleaned;
}

export function getImageNaturalSize(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl = null;

    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    img.onload = () => {
      const size = { width: img.width, height: img.height };
      cleanup();
      resolve(size);
    };
    img.onerror = () => {
      cleanup();
      reject(new Error('Failed to load image for sizing'));
    };

    if (typeof source === 'string') {
      img.src = source;
    } else if (typeof Blob !== 'undefined' && source instanceof Blob) {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    } else {
      reject(new Error('Unsupported image source'));
    }
  });
}

export function fitImageDimensions(naturalWidth, naturalHeight, maxWidth = 400, maxHeight = 300) {
  let width = naturalWidth;
  let height = naturalHeight;
  if (width > maxWidth) {
    height = (maxWidth / width) * height;
    width = maxWidth;
  }
  if (height > maxHeight) {
    width = (maxHeight / height) * width;
    height = maxHeight;
  }
  return { width, height };
}
