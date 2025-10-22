import { Router } from 'express';
import prisma from '../prisma.js';
import { authRequired, currentUser } from '../middleware/auth.js';
import { registrationSchema } from '../validations/registration.js';
import { sendMail, registrationEmail } from '../services/mailer.js';

const router = Router();

router.post('/', authRequired, currentUser, async (req, res) => {
  const { error, value } = registrationSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  // Change 'event' to 'events'
  const event = await prisma.events.findUnique({ where: { id: value.eventId } });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  // Change 'registration' to 'registrations'
  const count = await prisma.registrations.count({ where: { eventId: event.id } });
  if (count >= event.maxAttendees) return res.status(400).json({ message: 'Event is full' });

  const existing = await prisma.registrations.findFirst({
    where: { userId: req.user.id, eventId: event.id }
  });
  if (existing) return res.status(409).json({ message: 'Already registered' });
  const { randomUUID } = await import('crypto');

  const registration = await prisma.registrations.create({
    data: {
      id: randomUUID(), 
      userId: req.user.id,
      eventId: event.id,
      paymentStatus: event.paymentRequired ? 'PENDING' : 'PAID'
    }
  });

  try {
    if (!event.paymentRequired && process.env.MAIL_DISABLE !== 'true') {
      const email = registrationEmail({
        username: req.userEntity.username,
        eventTitle: event.title,
        dateTime: event.dateTime
      });
      await sendMail({ to: req.userEntity.email, ...email });
    }
  } catch (err) {
    console.error('Email send failed:', err.message);
    // Don't crash the request; continue
  }

  res.status(201).json(registration);
});

router.get('/:userId', authRequired, async (req, res) => {
  if (req.user.role !== 'ADMIN' && req.user.id !== req.params.userId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  // Change to 'registrations' and include 'events'
  const regs = await prisma.registrations.findMany({
    where: { userId: req.params.userId },
    include: { events: true }  // Changed from 'event' to 'events'
  });
  res.json(regs);
});

router.delete('/:id', authRequired, async (req, res) => {
  // Change 'registration' to 'registrations'
  const reg = await prisma.registrations.findUnique({ where: { id: req.params.id } });
  if (!reg) return res.status(404).json({ message: 'Not found' });
  if (req.user.role !== 'ADMIN' && req.user.id !== reg.userId) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  await prisma.registrations.delete({ where: { id: reg.id } });
  res.json({ message: 'Canceled' });
});

export default router;