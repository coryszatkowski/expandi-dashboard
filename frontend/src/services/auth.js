/**
 * Authentication Service
 * 
 * Handles admin authentication and session management.
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://backend-production-b2e1.up.railway.app';

/**
 * Check if user is authenticated as admin
 */
export const isAuthenticated = () => {
  try {
    const session = localStorage.getItem('adminSession');
    if (!session) return false;
    
    const sessionData = JSON.parse(session);
    
    // Check if session is valid (not expired)
    const now = Date.now();
    const sessionAge = now - sessionData.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (sessionAge > maxAge) {
      localStorage.removeItem('adminSession');
      return false;
    }
    
    return sessionData.authenticated === true;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
};

/**
 * Get current admin user info
 */
export const getCurrentUser = () => {
  try {
    const session = localStorage.getItem('adminSession');
    if (!session) return null;
    
    const sessionData = JSON.parse(session);
    return sessionData.user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Login admin user
 */
export const login = async (username, password) => {
  try {
    const response = await fetch(`${API_URL.replace(/\/$/, '')}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (data.success) {
      // Store session
      localStorage.setItem('adminSession', JSON.stringify({
        authenticated: true,
        user: data.user,
        timestamp: Date.now()
      }));
      
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
};

/**
 * Logout admin user
 */
export const logout = () => {
  localStorage.removeItem('adminSession');
};

/**
 * Change password for current admin
 */
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Change password error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
};

/**
 * Add new admin user
 */
export const addAdmin = async (username, password) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/add-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Add admin error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
};

/**
 * Get list of all admins
 */
export const getAdmins = async () => {
  try {
    const response = await fetch(`${API_URL}/api/auth/admins`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get admins error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
};

/**
 * Check if route requires authentication
 */
export const requiresAuth = (pathname) => {
  return pathname.startsWith('/admin');
};

export default {
  isAuthenticated,
  getCurrentUser,
  login,
  logout,
  changePassword,
  addAdmin,
  getAdmins,
  requiresAuth
};
