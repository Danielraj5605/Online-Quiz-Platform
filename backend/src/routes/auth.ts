import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loginSchema, registerSchema, profileUpdateSchema, passwordChangeSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@quizzo.com';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Generate verification token
const generateToken = () => crypto.randomBytes(32).toString('hex');

router.post('/register', validateBody(registerSchema), async (req, res) => {
  try {
    const { username, email, password, name } = req.body;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      res.status(400).json({ error: 'Username or email already taken' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = generateToken();
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await prisma.user.create({
      data: {
        username,
        email,
        name,
        password: hashedPassword,
        verificationToken,
        verificationTokenExpiry,
      },
    });

    // In production, send verification email here
    // For now, we'll include the token in the response (in production, don't do this)
    const verifyUrl = `${APP_URL}/verify-email?token=${verificationToken}`;
    console.log(`Verification email would be sent to ${email}: ${verifyUrl}`);

    res.status(201).json({
      message: 'User registered successfully. Please verify your email.',
      userId: user.id,
      // Remove this in production - only for development
      verificationToken: process.env.NODE_ENV !== 'production' ? verificationToken : undefined
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify email endpoint
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Verification token is required' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gte: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired verification token' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findFirst({ where: { email } });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      res.status(423).json({ error: `Account is locked. Try again in ${remainingMinutes} minutes.` });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Increment failed login attempts
      const newAttempts = user.failedLoginAttempts + 1;
      const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null; // Lock for 15 min after 5 attempts

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          lockUntil,
        },
      });

      if (lockUntil) {
        res.status(423).json({ error: 'Too many failed attempts. Account locked for 15 minutes.' });
        return;
      }

      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockUntil: null,
        },
      });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password
router.post('/forgot-password', validateBody(forgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findFirst({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: 'If an account exists, a reset email has been sent.' });
      return;
    }

    const resetToken = generateToken();
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // In production, send reset email here
    const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;
    console.log(`Password reset email would be sent to ${email}: ${resetUrl}`);

    res.json({ message: 'If an account exists, a reset email has been sent.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password
router.post('/reset-password', validateBody(resetPasswordSchema), async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        failedLoginAttempts: 0,
        lockUntil: null,
      },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get profile
router.get('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, username: true, email: true, name: true, role: true, avatar: true, createdAt: true, updatedAt: true }
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update profile
router.put('/profile', authenticate, validateBody(profileUpdateSchema), async (req: AuthRequest, res) => {
  try {
    const { username, email, name, avatar, password } = req.body;
    const userId = req.user!.userId;

    if (!username && !email && !name && !avatar && !password) {
      res.status(400).json({ error: 'Nothing to update' });
      return;
    }

    if (username) {
      const exists = await prisma.user.findFirst({ where: { username, NOT: { id: userId } } });
      if (exists) {
        res.status(400).json({ error: 'Username already taken' });
        return;
      }
    }
    if (email) {
      const exists = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
      if (exists) {
        res.status(400).json({ error: 'Email already in use' });
        return;
      }
    }

    let hashed: string | undefined;
    if (password) {
      hashed = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        username: username ?? undefined,
        email: email ?? undefined,
        name: name ?? undefined,
        avatar: avatar ?? undefined,
        password: hashed ?? undefined,
      },
      select: { id: true, username: true, email: true, name: true, role: true, avatar: true, createdAt: true, updatedAt: true }
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Alias for current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, username: true, email: true, name: true, role: true, avatar: true, createdAt: true, updatedAt: true }
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.put('/password', authenticate, validateBody(passwordChangeSchema), async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    res.json({ message: 'Password updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
