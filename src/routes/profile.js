import { Router } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { uploadAvatar, processAvatar } from '../middleware/uploadAvatar.js';
import { updateProfileSchema, changePasswordSchema } from '../validations/profile.js';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

// GET /api/profile/me - Get the current logged-in user's full profile with favorites
router.get('/me', authRequired, async (req, res, next) => {
  try {
    const userProfile = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true, 
        fullName: true,
        bio: true,
        avatarUrl: true,
        location: true,
        website: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            organizedEvents: true,
            registrations: true,
          },
        },
        favoriteCategories: {
          include: {
            category: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
    });

    if (!userProfile) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    // Format the response
    const formattedProfile = {
      ...userProfile,
      favoriteCategories: userProfile.favoriteCategories.map(fc => fc.category)
    };

    res.json(formattedProfile);
  } catch (error) {
    next(error);
  }
});
// GET /api/profile/user/:id - Get a public user profile by their ID
router.get('/user/:id', async (req, res, next) => {
  try {
    const profile = await prisma.users.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        bio: true,
        avatarUrl: true,
        location: true,
        website: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            organizedEvents: true
          }
        }
      }
    });

    if (!profile) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If the user is an organizer, fetch their upcoming public events
    if (profile.role === 'ORGANIZER') {
      const events = await prisma.events.findMany({
        where: { 
          organizerId: req.params.id,
          status: 'SCHEDULED'
        },
        select: {
          id: true,
          title: true,
          dateTime: true,
          location: true,
          imageUrl: true,
          thumbnailUrl: true
        },
        take: 6,
        orderBy: { dateTime: 'asc' }
      });
      profile.upcomingEvents = events;
    }

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

// PUT /api/profile/me - Update the current user's profile
router.put('/me', authRequired, uploadAvatar, processAvatar, async (req, res, next) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details.message });
    }

    const userId = req.user.id;
    const dataToUpdate = {...value };

    // If a new avatar was uploaded, handle file deletion and update the URL
    if (req.uploadedAvatar) {
      // If the user already has an avatar, delete the old file from the server
      if (req.user.avatarUrl) {
        try {
          const oldFilename = path.basename(new URL(req.user.avatarUrl).pathname);
          const oldAvatarPath = path.join('uploads', 'avatars', oldFilename);
          await fs.unlink(oldAvatarPath);
        } catch (fileError) {
          console.error('Could not delete old avatar:', fileError.message);
        }
      }
      // Add the URL of the new avatar to our update data
      dataToUpdate.avatarUrl = req.uploadedAvatar;
    }

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: dataToUpdate,
      select: { // Return the updated profile, excluding sensitive info
        id: true, email: true, username: true, role: true, fullName: true,
        bio: true, avatarUrl: true, phone: true, location: true, website: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});


// PATCH update user profile including favorite categories
router.patch('/profile', authRequired, async (req, res, next) => {
  try {
    const { 
      fullName, 
      bio, 
      location, 
      phone, 
      website,
      favoriteCategories // Array of category IDs
    } = req.body;

    const updateData = {};
    
    // Add basic fields to update
    if (fullName !== undefined) updateData.fullName = fullName;
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;
    if (phone !== undefined) updateData.phone = phone;
    if (website !== undefined) updateData.website = website;

    // Handle favorite categories update
    if (favoriteCategories !== undefined) {
      if (!Array.isArray(favoriteCategories)) {
        return res.status(400).json({ message: 'favoriteCategories must be an array' });
      }

      // Verify all categories exist
      if (favoriteCategories.length > 0) {
        const categories = await prisma.categories.findMany({
          where: {
            id: { in: favoriteCategories }
          }
        });

        if (categories.length !== favoriteCategories.length) {
          return res.status(400).json({ message: 'One or more categories not found' });
        }
      }

      // Update favorite categories in a transaction
      await prisma.$transaction(async (tx) => {
        // Remove all existing favorites
        await tx.user_favorite_categories.deleteMany({
          where: { userId: req.user.id }
        });

        // Add new favorites
        if (favoriteCategories.length > 0) {
          await tx.user_favorite_categories.createMany({
            data: favoriteCategories.map(categoryId => ({
              id: randomUUID(),
              userId: req.user.id,
              categoryId
            }))
          });
        }
      });
    }

    // Update user profile
    const updatedUser = await prisma.users.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        bio: true,
        location: true,
        phone: true,
        website: true,
        avatarUrl: true,
        role: true,
        updatedAt: true,
        favoriteCategories: {
          include: {
            category: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    // Format the response
    const formattedUser = {
      ...updatedUser,
      favoriteCategories: updatedUser.favoriteCategories.map(fc => fc.category)
    };

    res.json({
      message: 'Profile updated successfully',
      user: formattedUser
    });
  } catch (error) {
    next(error);
  }
});

// GET events from user's favorite categories
router.get('/events/recommended', authRequired, async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Get user's favorite categories
    const favoriteCategories = await prisma.user_favorite_categories.findMany({
      where: { userId: req.user.id },
      select: { categoryId: true }
    });

    const categoryIds = favoriteCategories.map(fc => fc.categoryId);

    if (categoryIds.length === 0) {
      return res.json({
        message: 'No favorite categories set. Add some categories to get recommendations!',
        events: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          pages: 0
        }
      });
    }

    // Get events from favorite categories
    const where = {
      categoryId: { in: categoryIds },
      status: 'SCHEDULED',
      dateTime: { gte: new Date() } // Only upcoming events
    };

    const [events, total] = await Promise.all([
      prisma.events.findMany({
        where,
        orderBy: { dateTime: 'asc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          categories: { select: { id: true, name: true } },
          organizer: { select: { id: true, username: true } },
          _count: { select: { registrations: true } }
        }
      }),
      prisma.events.count({ where })
    ]);

    res.json({
      events,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
});
// POST /api/profile/change-password - Change the user's password
router.post('/change-password', authRequired, async (req, res, next) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details.message });
    }

    // Fetch the full user object, including the password hash, for comparison
    const user = await prisma.users.findUnique({ where: { id: req.user.id } });

    const isMatch = await bcrypt.compare(value.currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    const newPasswordHash = await bcrypt.hash(value.newPassword, 10);

    await prisma.users.update({
      where: { id: req.user.id },
      data: { passwordHash: newPasswordHash },
    });

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/profile/me - Delete the current user's account
router.delete('/me', authRequired, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password is required to delete your account' });
    }

    // Fetch the full user object to verify the password
    const user = await prisma.users.findUnique({ where: { id: req.user.id } });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // If the user has an avatar, delete it from the server
    if (user.avatarUrl) {
      try {
        const filename = path.basename(new URL(user.avatarUrl).pathname);
        const filepath = path.join('uploads', 'avatars', filename);
        await fs.unlink(filepath);
      } catch (err) {
        console.error('Failed to delete avatar during account deletion:', err);
      }
    }

    // Delete the user from the database
    await prisma.users.delete({
      where: { id: req.user.id }
    });

    res.status(200).json({ message: 'Your account has been permanently deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;