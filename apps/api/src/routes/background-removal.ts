import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';

const bgRemoval = new Hono<{ Variables: AppVariables }>();
bgRemoval.use('*', authMiddleware);

const FAL_KEY = process.env.FAL_KEY;
const FAL_ENDPOINT = 'https://queue.fal.run/fal-ai/bria/background/remove';
const BUCKET = 'wardrobe-images';

const removeBackgroundSchema = z.object({
  image_url: z.string().url(),
});

// ── POST /wardrobe/items/remove-background ──────────────────

bgRemoval.post(
  '/items/remove-background',
  zValidator('json', removeBackgroundSchema),
  async (c) => {
    if (!FAL_KEY) {
      return c.json(
        { data: null, error: { code: 'CONFIG_ERROR', message: 'FAL_KEY not configured' } },
        500
      );
    }

    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const { image_url } = c.req.valid('json');

    // Call fal.ai synchronously (queue mode with polling)
    let falResult: { image: { url: string } };
    try {
      // Submit the request
      const submitRes = await fetch(FAL_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_url }),
      });

      if (!submitRes.ok) {
        const errBody = await submitRes.text();
        return c.json(
          { data: null, error: { code: 'FAL_SUBMIT_ERROR', message: `fal.ai returned ${submitRes.status}: ${errBody}` } },
          502
        );
      }

      const submitData = await submitRes.json() as {
        request_id: string;
        status_url?: string;
        response_url?: string;
      };

      // If the response came back directly (synchronous), use it
      if ('image' in submitData) {
        falResult = submitData as unknown as { image: { url: string } };
      } else {
        // Poll for the result
        const responseUrl =
          submitData.response_url ??
          `https://queue.fal.run/fal-ai/bria/background/remove/requests/${submitData.request_id}`;

        falResult = await pollForResult(responseUrl);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown fal.ai error';
      return c.json(
        { data: null, error: { code: 'FAL_ERROR', message } },
        502
      );
    }

    const cleanImageUrl = falResult.image.url;

    // Download the clean image and re-upload to Supabase Storage
    let storedUrl = cleanImageUrl; // fallback to fal.ai URL if re-upload fails
    try {
      const imageRes = await fetch(cleanImageUrl);
      if (imageRes.ok) {
        const imageBuffer = await imageRes.arrayBuffer();
        const ct = imageRes.headers.get('content-type') ?? 'image/png';
        const ext = ct.includes('webp') ? 'webp' : 'png';
        const filePath = `${userId}/clean-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, imageBuffer, { contentType: ct, upsert: false });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
          storedUrl = urlData.publicUrl;
        }
      }
    } catch {
      // Non-fatal — use fal.ai URL directly
    }

    return c.json({
      data: {
        original_url: image_url,
        clean_url: storedUrl,
      },
      error: null,
    });
  }
);

/** Polls fal.ai queue until the result is ready. Timeout after 60s. */
async function pollForResult(
  responseUrl: string,
  timeoutMs = 60_000,
  intervalMs = 1_000
): Promise<{ image: { url: string } }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(responseUrl, {
      headers: { Authorization: `Key ${FAL_KEY!}` },
    });

    if (res.status === 200) {
      return res.json() as Promise<{ image: { url: string } }>;
    }

    if (res.status !== 202) {
      const errBody = await res.text();
      throw new Error(`fal.ai poll returned ${res.status}: ${errBody}`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error('fal.ai background removal timed out after 60 seconds');
}

export default bgRemoval;
