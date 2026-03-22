import { Hono } from 'hono';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';

const upload = new Hono<{ Variables: AppVariables }>();
upload.use('*', authMiddleware);

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const BUCKET = 'wardrobe-images';

// ── POST /wardrobe/items/upload — Upload image to Supabase Storage ─

upload.post('/items/upload', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');

  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return c.json(
      { data: null, error: { code: 'INVALID_CONTENT_TYPE', message: 'Expected multipart/form-data' } },
      400
    );
  }

  const formData = await c.req.formData();
  const file = formData.get('image');

  if (!file || !(file instanceof File)) {
    return c.json(
      { data: null, error: { code: 'MISSING_FILE', message: 'No image file provided. Use field name "image".' } },
      400
    );
  }

  // Validate file type
  if (!ALLOWED_TYPES.has(file.type)) {
    return c.json(
      {
        data: null,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: `File type "${file.type}" not allowed. Accepted: JPEG, PNG, WebP.`,
        },
      },
      400
    );
  }

  // Validate file size
  if (file.size > MAX_SIZE_BYTES) {
    return c.json(
      {
        data: null,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 10MB limit.`,
        },
      },
      400
    );
  }

  // Generate unique path: {userId}/{timestamp}-{random}.{ext}
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const filePath = `${userId}/${timestamp}-${random}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return c.json(
      { data: null, error: { code: 'UPLOAD_FAILED', message: uploadError.message } },
      500
    );
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  return c.json({
    data: {
      path: filePath,
      public_url: urlData.publicUrl,
    },
    error: null,
  }, 201);
});

export default upload;
