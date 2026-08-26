import express from 'express';
import { body } from 'express-validator';
import { register, login, refresh, getCurrentUser } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Validation rules
const registerValidation = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty if provided'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh', authMiddleware, refresh);
router.get('/me', authMiddleware, getCurrentUser);

export default router;
