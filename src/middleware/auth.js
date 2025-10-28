import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';

// REQUIRED authentication - blocks if no valid token
export function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [type, token] = header.split(' ');
    
    if (type !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Missing or invalid token' });
    }
    
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// OPTIONAL authentication - sets user if token exists, continues regardless
export async function currentUser(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [type, token] = header.split(' ');
    
    // No token? No problem! Continue without user
    if (type !== 'Bearer' || !token) {
      req.user = null;
      req.userEntity = null;
      return next();
    }
    
    // Try to verify the token
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      
      // Fetch the full user entity if we have a valid token
      const user = await prisma.users.findUnique({ 
        where: { id: payload.id },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          avatarUrl: true
        }
      });
      
      if (user) {
        req.user = payload; // Token payload
        req.userEntity = user; // Full user object
      } else {
        req.user = null;
        req.userEntity = null;
      }
    } catch (tokenError) {
      // Invalid token? Continue without user
      req.user = null;
      req.userEntity = null;
    }
    
    next();
  } catch (error) {
    // Any other error? Continue without user
    req.user = null;
    req.userEntity = null;
    next();
  }
}