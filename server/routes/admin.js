import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { canManageUsers, canManagePrivileges } from '../middleware/adminAuth.js';
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  updateUserPrivileges
} from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require authentication
router.use(authMiddleware);

// User management routes - require userManagement privilege or admin role
router.get('/users', canManageUsers, getAllUsers);
router.post('/users', canManageUsers, createUser);
router.put('/users/:userId', canManageUsers, updateUser);
router.delete('/users/:userId', canManageUsers, deleteUser);

// Privilege management - requires privilegeManagement privilege or admin role
router.put('/users/:userId/privileges', canManagePrivileges, updateUserPrivileges);

export default router;
