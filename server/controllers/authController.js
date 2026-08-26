import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

// Calculate token expiry in seconds
const getExpiresIn = () => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  const hours = parseInt(expiresIn);
  return hours * 3600; // Convert to seconds
};

// Register new user
export const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user with name or default from email
    const userName = name || email.split('@')[0];
    const userRole = role && ['user', 'admin'].includes(role) ? role : 'user';
    const user = new User({ name: userName, email, password, role: userRole });
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      expiresIn: getExpiresIn(),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        privileges: user.privileges
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      expiresIn: getExpiresIn(),
      user: {
        id: user._id,
        name: user.name || user.email.split('@')[0], // Fallback to email username if no name
        email: user.email,
        role: user.role,
        privileges: user.privileges
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// Refresh token
export const refresh = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify user still exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate new token
    const token = generateToken(user._id);

    res.json({
      message: 'Token refreshed',
      token,
      expiresIn: getExpiresIn()
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ message: 'Server error during token refresh' });
  }
};

// Get current user
export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find user and exclude password
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name || user.email.split('@')[0],
        email: user.email,
        role: user.role,
        privileges: user.privileges
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
