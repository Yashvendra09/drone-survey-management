// backend/src/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js'; 

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_strong_secret';

export default async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || req.headers.Authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing auth token' });
    }

    const token = header.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);

    // Attach user minimal info
    req.user = { id: payload.sub, email: payload.email, role: payload.role };


    next();
  } catch (err) {
    console.error('authMiddleware error', err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
