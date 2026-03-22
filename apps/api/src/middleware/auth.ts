import { Context, Next } from 'hono';
import { getAdminClient, createUserClient } from '../lib/supabase';

/**
 * Hono middleware that validates the Supabase JWT from the Authorization header,
 * then injects { userId, supabase } into c.var for downstream handlers.
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } },
      401
    );
  }

  const token = authHeader.slice(7); // strip "Bearer "

  // Validate the JWT via Supabase's getUser — this hits Supabase auth and verifies the token
  const adminClient = getAdminClient();
  const { data, error } = await adminClient.auth.getUser(token);

  if (error || !data.user) {
    return c.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
      401
    );
  }

  const userId = data.user.id;
  const userClient = createUserClient(token);

  // Inject auth context into Hono's context
  c.set('userId', userId);
  c.set('supabase', userClient);

  await next();
}
