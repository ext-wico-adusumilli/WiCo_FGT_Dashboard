import User from '../models/User.js';

export const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ message: 'Server error during authorization' });
  }
};

// Check if user has userManagement privilege or is admin
export const canManageUsers = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Admin role has all privileges
    if (user.role === 'admin') {
      return next();
    }

    // Check for userManagement privilege in administration group
    if (user.privileges?.administration?.userManagement === true) {
      return next();
    }

    return res.status(403).json({ message: 'Access denied. User management privileges required.' });
  } catch (error) {
    console.error('User management auth error:', error);
    res.status(500).json({ message: 'Server error during authorization' });
  }
};

// Check if user has privilegeManagement privilege or is admin
export const canManagePrivileges = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Admin role has all privileges
    if (user.role === 'admin') {
      return next();
    }

    // Check for privilegeManagement privilege in administration group
    if (user.privileges?.administration?.privilegeManagement === true) {
      return next();
    }

    return res.status(403).json({ message: 'Access denied. Privilege management privileges required.' });
  } catch (error) {
    console.error('Privilege management auth error:', error);
    res.status(500).json({ message: 'Server error during authorization' });
  }
};

// Alias for consistency with other route files
export const requireAdmin = isAdmin;
