import jwt from 'jsonwebtoken';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { Context } from 'hono';

const COOKIE = 'token';

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

export interface JWTPayload {
  userId: string;
  username: string;
}

export function signJWT(payload: JWTPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: '7d' });
}

export function verifyJWT(token: string): JWTPayload {
  const decoded = jwt.verify(token, secret());
  if (typeof decoded === 'string') throw new Error('Invalid token');
  return decoded as JWTPayload;
}

export function setAuthCookie(c: Context, token: string): void {
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export function clearAuthCookie(c: Context): void {
  deleteCookie(c, COOKIE, { path: '/' });
}
