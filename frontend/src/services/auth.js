// backend/src/routes/auth.js
import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_strong_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function makeError(res, status, msg, extra = {}) {
  return res.status(status).json({ error: msg, ...extra });
}

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 chars'),
    body('name').optional().isLength({ min: 1 }).withMessage('Name must be non-empty if provided'),
  ],
  async (req, res) => {
    // removed debugLog to avoid runtime ReferenceError

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
    }

    try {
      const { email, password, name } = req.body;

      if (!email || !password) return makeError(res, 400, 'email and password are required');

      const existing = await User.findOne({ email: email.toLowerCase() }).exec();
      if (existing) return makeError(res, 400, 'Email already in use');

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = new User({ email: email.toLowerCase(), passwordHash, name });
      await user.save();

      const token = jwt.sign({ sub: user._id, role: user.role, email: user.email }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      return res.status(201).json({
        token,
        user: { id: user._id, email: user.email, name: user.name, role: user.role },
      });
    } catch (err) {
      console.error('Register error:', err && err.stack ? err.stack : err);
      return makeError(res, 500, 'Server error during register');
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').exists().withMessage('Password required'),
  ],
  async (req, res) => {
    // removed debugLog

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', errors: errors.array() });
    }

    try {
      const { email, password } = req.body;
      if (!email || !password) return makeError(res, 400, 'email and password are required');

      const user = await User.findOne({ email: email.toLowerCase() }).exec();
      if (!user) return makeError(res, 401, 'Invalid email or password');

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return makeError(res, 401, 'Invalid email or password');

      const token = jwt.sign({ sub: user._id, role: user.role, email: user.email }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      return res.json({ token, user: { id: user._id, email: user.email, name: user.name, role: user.role } });
    } catch (err) {
      console.error('Login error:', err && err.stack ? err.stack : err);
      return makeError(res, 500, 'Server error during login');
    }
  }
);

export default router;
