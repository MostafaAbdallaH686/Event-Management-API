import { Router } from 'express';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = Router();

router.get('/dashboard', authRequired, authorize('ADMIN','ORGANIZER'), async (req, res) => {
  const [eventsCount, usersCount, regsCount] = await Promise.all([
    prisma.events.count(),  // Changed from 'event' to 'events'
    prisma.users.count(),   // Changed from 'user' to 'users'
    prisma.registrations.count(),  // Changed from 'registration' to 'registrations'
  ]);

  if (req.user.role === 'ORGANIZER') {
    const myEvents = await prisma.events.findMany({ where: { organizerId: req.user.id } });
    const myEventIds = myEvents.map(e => e.id);
    const myRegs = await prisma.registrations.count({ where: { eventId: { in: myEventIds } } });

    return res.json({
      role: 'ORGANIZER',
      eventsCount: myEvents.length,
      registrationsCount: myRegs
    });
  }

  res.json({ role: 'ADMIN', eventsCount, usersCount, registrationsCount: regsCount });
});

export default router;