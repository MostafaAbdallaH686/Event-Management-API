import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';
import { randomUUID } from 'crypto';

const ACCESS_TOKEN_EXPIRES = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
}

export function generateRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
}

export async function saveRefreshToken(userId, token) {
  // Calculate expiry (30 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  return prisma.refreshToken.create({
    data: {
      id: randomUUID(),
      token,
      userId,
      expiresAt,
    },
  });
}

export async function validateRefreshToken(token) {
  const stored = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });
  
  if (!stored) return null;
  if (stored.expiresAt < new Date()) {
    // Token expired, delete it
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    return null;
  }
  
  return stored;
}

export async function revokeRefreshToken(token) {
  return prisma.refreshToken.deleteMany({ where: { token } });
}

export async function revokeAllUserTokens(userId) {
  return prisma.refreshToken.deleteMany({ where: { userId } });
}

// Clean up expired tokens (run periodically)
export async function cleanExpiredTokens() {
  return prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}