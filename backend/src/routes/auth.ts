import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signJWT, verifyJWT, setAuthCookie, clearAuthCookie } from '../lib/auth';

const app = new Hono();

app.post('/signup', async (c) => {
  const { username, password, inviteCode } = await c.req.json() as {
    username: string; password: string; inviteCode: string;
  };

  if (inviteCode !== process.env.INVITE_CODE) {
    return c.json({ error: 'Invalid invite code' }, 403);
  }
  if (!username || username.length < 3) {
    return c.json({ error: 'Username must be at least 3 characters' }, 400);
  }
  if (!password || password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return c.json({ error: 'Username already taken' }, 409);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { username, passwordHash } });

  const token = signJWT({ userId: user.id, username: user.username });
  setAuthCookie(c, token);

  return c.json({ id: user.id, username: user.username }, 201);
});

app.post('/login', async (c) => {
  const { username, password } = await c.req.json() as {
    username: string; password: string;
  };

  const user = await prisma.user.findUnique({ where: { username } });
  // Constant-time comparison: always run bcrypt even if user not found
  const hash = user?.passwordHash ?? '$2b$12$invalidhashpadding000000000000000000000000000000000000000';
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid) {
    return c.json({ error: 'Invalid username or password' }, 401);
  }

  const token = signJWT({ userId: user.id, username: user.username });
  setAuthCookie(c, token);

  return c.json({ id: user.id, username: user.username });
});

app.post('/logout', (c) => {
  clearAuthCookie(c);
  return c.json({ success: true });
});

app.get('/me', (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  try {
    const { userId, username } = verifyJWT(token);
    return c.json({ id: userId, username });
  } catch {
    return c.json({ error: 'Invalid session' }, 401);
  }
});

export default app;
