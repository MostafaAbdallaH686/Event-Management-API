  
import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';

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

export async function currentUser(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
  
  const user = await prisma.users.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  
  req.userEntity = user;
  next();
}