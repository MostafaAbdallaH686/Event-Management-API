import { Router } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
import { sendMail } from '../services/mailer.js';

const router = Router();

// POST notify attendees (ADMIN or organizer of that event)
router.post('/', authRequired, authorize('ADMIN','ORGANIZER'), async (req, res, next) => {
  try {
    const { eventId, message } = req.body;
    
    if (!eventId || !message) {
      return res.status(400).json({ message: 'eventId and message required' });
    }

    // Get event with organizer details
    const event = await prisma.events.findUnique({ 
      where: { id: eventId }, 
      include: { organizer: true }  // Correct relation name
    });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check permissions
    if (req.user.role !== 'ADMIN' && event.organizerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Get all registrations with user details
    const regs = await prisma.registrations.findMany({
      where: { eventId },
      include: { users: true }  // Changed from 'user' to 'users'
    });

    // Send notifications and emails to all registered users
    await Promise.all(regs.map(async r => {
      // Create notification with all required fields
      await prisma.notifications.create({
        data: { 
          id: randomUUID(),  // Required field
          userId: r.userId,  // Who receives the notification
          organizerId: req.user.id,  // Who sent the notification (required in your schema)
          eventId, 
          message 
        }
      });
      
      // Send email
      await sendMail({
        to: r.users.email,  // Changed from r.user.email to r.users.email
        subject: `Update for ${event.title}`,
        html: `<p>Hi ${r.users.username},</p>
               <p>${message}</p>
               <p>Event: <strong>${event.title}</strong></p>
               <p>Date: ${new Date(event.dateTime).toLocaleString()}</p>
               <p>Location: ${event.location}</p>`
      });
    }));

    res.json({ 
      message: 'Notifications sent successfully',
      count: regs.length 
    });
  } catch (error) {
    console.error('Notification error:', error);
    next(error);
  }
});

// GET notifications for current user
router.get('/my', authRequired, async (req, res, next) => {
  try {
    const notifications = await prisma.notifications.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        events: { 
          select: { 
            id: true, 
            title: true, 
            dateTime: true 
          } 
        },
        organizer: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });
    
    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

// Mark notification as read (optional - if you add a 'read' field)
router.patch('/:id/read', authRequired, async (req, res, next) => {
  try {
    const notification = await prisma.notifications.findUnique({
      where: { id: req.params.id }
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    if (notification.userId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    // You'd need to add a 'read' field to notifications model for this to work
    // const updated = await prisma.notifications.update({
    //   where: { id: req.params.id },
    //   data: { read: true }
    // });
    
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
});

export default router;