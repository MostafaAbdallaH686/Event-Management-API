import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma.js';
import { registerSchema, loginSchema } from '../validations/auth.js';
import { authRequired } from '../middleware/auth.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  saveRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} from '../services/tokenService.js';
import { randomUUID } from 'crypto';

const router = Router();

// REGISTER
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const exists = await prisma.users.findFirst({
      where: { OR: [{ email: value.email }, { username: value.username }] },
    });
    if (exists) return res.status(409).json({ message: 'Email or username already exists' });

    const passwordHash = await bcrypt.hash(value.password, 10);
    const user = await prisma.users.create({
      data: {
        id: randomUUID(),
        username: value.username,
        email: value.email,
        passwordHash,
        role: value.role || 'ATTENDEE',
      },
      select: { id: true, username: true, email: true, role: true },
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// LOGIN
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const user = await prisma.users.findUnique({ where: { email: value.email } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(value.password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    // Generate tokens
    const payload = { id: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Save refresh token to database
    await saveRefreshToken(user.id, refreshToken);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// REFRESH TOKEN
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Refresh token required' });

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const stored = await validateRefreshToken(refreshToken);
    if (!stored) return res.status(401).json({ message: 'Invalid or expired refresh token' });

    // Use stored.user (not stored.users)
    const newAccessToken = generateAccessToken({
      id: stored.user.id,      
      role: stored.user.role,   
    });

    const newRefreshToken = generateRefreshToken({
      id: stored.user.id,      
      role: stored.user.role,   
    });
    
    await revokeRefreshToken(refreshToken);
    await saveRefreshToken(stored.user.id, newRefreshToken);  

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// LOGOUT
router.post('/logout', authRequired, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      // Revoke specific token
      await revokeRefreshToken(refreshToken);
    } else {
      // Revoke all user's tokens
      await revokeAllUserTokens(req.user.id);
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// LOGOUT ALL SESSIONS
router.post('/logout-all', authRequired, async (req, res, next) => {
  try {
    await revokeAllUserTokens(req.user.id);
    res.json({ message: 'All sessions logged out' });
  } catch (err) {
    next(err);
  }
});

export default router;