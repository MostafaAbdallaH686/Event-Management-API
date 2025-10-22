import { Router } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../prisma.js';
import imageService from '../services/imageService.js';
import { authRequired, currentUser } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
import { createEventSchema, updateEventSchema } from '../validations/event.js';
import { uploadEventImage, processEventImage, handleUploadError } from '../middleware/upload.js';
import { parseFormDataTypes } from '../middleware/parseFormData.js';

const router = Router();

// GET all events
router.get('/', async (req, res, next) => {
  try {
    const { categoryId, status, organizerId, page = 1, limit = 10 } = req.query;
    
    const where = {};
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (organizerId) where.organizerId = organizerId;

    const events = await prisma.events.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      include: {
        categories: { select: { id: true, name: true } },
        organizer: { select: { id: true, username: true } },
        _count: { select: { registrations: true } }
      }
    });
    
    const total = await prisma.events.count({ where });
    
    res.json({
      events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET event by id
router.get('/:id', async (req, res, next) => {
  try {
    const event = await prisma.events.findUnique({
      where: { id: req.params.id },
      include: {
        categories: { select: { id: true, name: true } },
        organizer: { select: { id: true, username: true, email: true } },
        _count: { select: { registrations: true } }
      }
    });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json(event);
  } catch (error) {
    next(error);
  }
});

// GET events for current organizer
router.get('/my/organized', authRequired, async (req, res, next) => {
  try {
    const events = await prisma.events.findMany({
      where: { organizerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        categories: { select: { id: true, name: true } },
        _count: { 
          select: { 
            registrations: true,
            notifications: true 
          } 
        }
      }
    });
    
    res.json(events);
  } catch (error) {
    next(error);
  }
});

// POST create event
router.post('/',
  authRequired,
  currentUser,
  authorize('ORGANIZER', 'ADMIN'),
  uploadEventImage,
  processEventImage,
  parseFormDataTypes,
  handleUploadError,
  async (req, res, next) => {
    try {
      // Validate input
      const { error, value } = createEventSchema.validate(req.body, { 
        abortEarly: false,
        convert: true 
      });
      
      if (error) {
        return res.status(400).json({
          message: 'Validation error',
          details: error.details
        });
      }

      // Verify category exists
      const category = await prisma.categories.findUnique({
        where: { id: value.categoryId }
      });
      
      if (!category) {
        return res.status(400).json({ message: 'Invalid category' });
      }

      // Ensure dateTime is properly formatted
      if (value.dateTime) {
        value.dateTime = new Date(value.dateTime);
      }

      // Create event
      const event = await prisma.events.create({
        data: {
          id: randomUUID(),
          ...value,
          organizerId: req.user.id
        },
        include: {
          categories: { select: { id: true, name: true } },
          organizer: { select: { id: true, username: true } }
        }
      });

      res.status(201).json(event);
    } catch (error) {
      console.error('Create event error:', error);
      next(error);
    }
  }
);

// PUT update event
router.put('/:id',
  authRequired,
  currentUser,
  authorize('ORGANIZER', 'ADMIN'),
  uploadEventImage,
  processEventImage,
  parseFormDataTypes,
  handleUploadError,
  async (req, res, next) => {
    try {
      // Check if event exists and user has permission
      const existing = await prisma.events.findUnique({
        where: { id: req.params.id }
      });
      
      if (!existing) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      if (req.user.role !== 'ADMIN' && existing.organizerId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // Validate input
      const { error, value } = updateEventSchema.validate(req.body, {
        abortEarly: false,
        convert: true
      });
      
      if (error) {
        return res.status(400).json({
          message: 'Validation error',
          details: error.details
        });
      }

      // Ensure dateTime is properly formatted if provided
      if (value.dateTime) {
        value.dateTime = new Date(value.dateTime);
      }

      // If new image uploaded and different from existing, delete old one
      if (value.imageUrl && existing.imageUrl && value.imageUrl !== existing.imageUrl) {
        try {
          await imageService.deleteImage(existing.imageUrl);
        } catch (err) {
          console.error('Failed to delete old image:', err);
        }
      }

      // Update event
      const event = await prisma.events.update({
        where: { id: req.params.id },
        data: value,
        include: {
          categories: { select: { id: true, name: true } },
          organizer: { select: { id: true, username: true } }
        }
      });

      res.json(event);
    } catch (error) {
      console.error('Update event error:', error);
      next(error);
    }
  }
);

// DELETE event
router.delete('/:id',
  authRequired,
  authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const event = await prisma.events.findUnique({
        where: { id: req.params.id }
      });
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Delete image if exists
      if (event.imageUrl) {
        try {
          await imageService.deleteImage(event.imageUrl);
        } catch (err) {
          console.error('Failed to delete image:', err);
        }
      }
      
      if (event.thumbnailUrl) {
        try {
          await imageService.deleteImage(event.thumbnailUrl);
        } catch (err) {
          console.error('Failed to delete thumbnail:', err);
        }
      }

      // Delete event (cascades to related records)
      await prisma.events.delete({
        where: { id: req.params.id }
      });

      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;