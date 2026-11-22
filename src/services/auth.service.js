import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/user.model.js';
import { ApiError } from '../utils/apiResponse.js';

const signToken = (user) => {
  return jwt.sign({ id: user._id, username: user.username, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
};

export const ensureDefaultAdmin = async () => {
  const count = await User.countDocuments();
  if (count === 0) {
    await User.create({
      name: 'Sahil Optical Admin',
      username: 'admin',
      password: 'password123',
      role: 'admin',
    });
  }
};

export const loginUser = async ({ username, password }) => {
  if (!username || !password) {
    throw new ApiError(400, 'Username and password are required');
  }

  const user = await User.findOne({ username: String(username).toLowerCase().trim() }).select(
    '+password'
  );

  if (!user) {
    throw new ApiError(401, 'Invalid username or password');
  }

  const isMatch = await user.comparePassword(String(password));
  if (!isMatch) {
    throw new ApiError(401, 'Invalid username or password');
  }

  const token = signToken(user);

  return {
    token,
    user: {
      _id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    },
  };
};

export const getCurrentUserById = async (userId) => {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return user;
};

export const updateUserCredentials = async (
  userId,
  { currentPassword, name, username, newPassword }
) => {
  if (!currentPassword) {
    throw new ApiError(400, 'Current password is required to update credentials');
  }

  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isMatch = await user.comparePassword(String(currentPassword));
  if (!isMatch) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  if (name !== undefined && String(name).trim()) {
    user.name = String(name).trim();
  }

  if (username !== undefined && String(username).trim()) {
    const cleanUsername = String(username).trim().toLowerCase();
    if (cleanUsername !== user.username) {
      const existing = await User.findOne({ username: cleanUsername, _id: { $ne: userId } });
      if (existing) {
        throw new ApiError(409, 'This username is already in use');
      }
      user.username = cleanUsername;
    }
  }

  if (newPassword !== undefined && String(newPassword) !== '') {
    if (String(newPassword).length < 6) {
      throw new ApiError(400, 'New password must be at least 6 characters long');
    }
    user.password = String(newPassword);
  }

  await user.save();
  const token = signToken(user);

  return {
    token,
    user: {
      _id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    },
  };
};
