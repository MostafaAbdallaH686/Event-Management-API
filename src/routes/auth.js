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
// POST /api/auth/google
router.post('/google', async (req, res, next) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ message: 'ID token is required' });
    }
    
    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;
    
    // Find or create user
    let user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    if (!user) {
      // Create new user
      user = await prisma.users.create({
        data: {
          email: email.toLowerCase(),
          username: name || email.split('@')[0],
          googleId,
          profilePicture: picture,
          role: 'ATTENDEE',
          emailVerified: true
        }
      });
    } else if (!user.googleId) {
      // Link Google to existing account
      user = await prisma.users.update({
        where: { id: user.id },
        data: { 
          googleId,
          emailVerified: true,
          profilePicture: user.profilePicture || picture
        }
      });
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);
    
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    next(error);
  }
});

// POST /api/auth/facebook
router.post('/facebook', async (req, res, next) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ message: 'Access token is required' });
    }
    
    // Verify Facebook token
    const fbResponse = await axios.get(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
    );
    
    const { id: facebookId, email, name, picture } = fbResponse.data;
    
    if (!email) {
      return res.status(400).json({ 
        message: 'Email permission is required' 
      });
    }
    
    // Find or create user
    let user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    if (!user) {
      user = await prisma.users.create({
        data: {
          email: email.toLowerCase(),
          username: name || email.split('@')[0],
          facebookId,
          profilePicture: picture?.data?.url,
          role: 'ATTENDEE',
          emailVerified: true
        }
      });
    } else if (!user.facebookId) {
      user = await prisma.users.update({
        where: { id: user.id },
        data: { 
          facebookId,
          emailVerified: true,
          profilePicture: user.profilePicture || picture?.data?.url
        }
      });
    }
    
    // Generate tokens
    const { accessToken: jwtAccessToken, refreshToken } = generateTokens(user);
    
    res.json({
      accessToken: jwtAccessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Facebook auth error:', error);
    next(error);
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