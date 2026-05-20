import { getCookie } from 'hono/cookie';
import type { Context, Next } from 'hono';
import { verifyJWT } from '../lib/auth';

export type AuthEnv = { Variables: { userId: string } };

export async function requireAuth(c: Context<AuthEnv>, next: Next) {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const payload = verifyJWT(token);
    c.set('userId', payload.userId);
    await next();
  } catch {
    return c.json({ error: 'Session expired — please log in again' }, 401);
  }
}
