<!-- Awesome spec. Here’s a clean, production-ready Node.js API that implements your Event Management System with role-based auth, events, registrations, payments, notifications, and analytics. It uses:

- Express (routing)
- Prisma ORM + SQL Server (you can switch to Postgres easily)
- JWT auth + bcrypt
- Role-based authorization middleware
- Stripe (payments, optional)
- Nodemailer (email notifications)
- Joi (validation)

You get:
- Users with roles: ADMIN, ORGANIZER, ATTENDEE
- Events CRUD
- Registrations (with payment flow)
- Email notifications
- Dashboards/analytics endpoints (basic)

Project structure
- prisma/
  - schema.prisma
- src/
  - app.js
  - index.js
  - prisma.js
  - middleware/
    - auth.js
    - roles.js
  - validations/
    - auth.js
    - event.js
    - registration.js
    - payment.js
  - services/
    - mailer.js
    - payments.js
  - routes/
    - auth.js
    - events.js
    - registrations.js
    - payments.js
    - notifications.js
    - admin.js
- .env
- package.json

1) package.json
```json
{
  "name": "event-management-api",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev --name init"
  },
  "dependencies": {
    "@prisma/client": "^5.19.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "joi": "^17.13.3",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0",
    "nodemailer": "^6.9.14",
    "stripe": "^16.2.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.4",
    "prisma": "^5.19.0"
  }
}
```

2) .env
```env
PORT=8080
JWT_SECRET=super-secret
# SQL Server (Prisma): format -> sqlserver://user:pass@host:1433;database=DB;encrypt=true;trustServerCertificate=true;
DATABASE_URL="sqlserver://sa:YourStrong!Passw0rd@localhost:1433;database=eventsdb;encrypt=true;trustServerCertificate=true;"

# Email (Nodemailer SMTP example)
SMTP_HOST=smtp.yourhost.com
SMTP_PORT=587
SMTP_USER=your_user
SMTP_PASS=your_pass
SMTP_FROM="Events <noreply@yourapp.com>"

# Stripe
STRIPE_SECRET_KEY=sk_test_...
```

Note: If you prefer Postgres, change provider to postgresql and DATABASE_URL accordingly.

3) prisma/schema.prisma
```prisma
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  ADMIN
  ORGANIZER
  ATTENDEE
}

enum EventStatus {
  SCHEDULED
  COMPLETED
  CANCELED
}

enum RegistrationPaymentStatus {
  PAID
  PENDING
  FAILED
}

enum TransactionStatus {
  SUCCESS
  FAILED
}

model User {
  id           String         @id @default(uuid())
  username     String         @unique
  email        String         @unique
  passwordHash String
  role         Role           @default(ATTENDEE)
  createdAt    DateTime       @default(now())
  events       Event[]        @relation("OrganizerEvents")
  registrations Registration[]
  transactions  PaymentTransaction[]
  notifications Notification[]
}

model Category {
  id    String  @id @default(uuid())
  name  String  @unique
  events Event[]
}

model Event {
  id             String       @id @default(uuid())
  title          String
  description    String
  dateTime       DateTime
  location       String
  maxAttendees   Int
  status         EventStatus  @default(SCHEDULED)
  paymentRequired Boolean      @default(false)
  organizerId    String
  organizer      User         @relation("OrganizerEvents", fields: [organizerId], references: [id])
  categoryId     String
  category       Category     @relation(fields: [categoryId], references: [id])
  createdAt      DateTime     @default(now())
  registrations  Registration[]
}

model Registration {
  id             String                     @id @default(uuid())
  userId         String
  user           User                       @relation(fields: [userId], references: [id])
  eventId        String
  event          Event                      @relation(fields: [eventId], references: [id])
  paymentStatus  RegistrationPaymentStatus   @default(PENDING)
  createdAt      DateTime                   @default(now())
}

model PaymentTransaction {
  id             String             @id @default(uuid())
  userId         String
  user           User               @relation(fields: [userId], references: [id])
  eventId        String
  event          Event              @relation(fields: [eventId], references: [id])
  amount         Float
  status         TransactionStatus
  transactionDate DateTime          @default(now())
  provider       String
  providerRef    String?
}

model Notification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  eventId   String?
  event     Event?   @relation(fields: [eventId], references: [id])
  message   String
  createdAt DateTime @default(now())
}
```

Run:
- npm i
- npx prisma generate
- npm run prisma:migrate

4) src/prisma.js
```js
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
```

5) src/middleware/auth.js
```js
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';

export function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');
    if (!token) return res.status(401).json({ message: 'Missing token' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role }
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export async function currentUser(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  req.userEntity = user;
  next();
}
```

6) src/middleware/roles.js
```js
export function authorize(...allowed) {
  return (req, res, next) => {
    if (!req.user?.role) return res.status(403).json({ message: 'Forbidden' });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}
```

7) src/validations/auth.js
```js
import Joi from 'joi';

export const registerSchema = Joi.object({
  username: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('ADMIN','ORGANIZER','ATTENDEE').default('ATTENDEE')
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});
```

8) src/validations/event.js
```js
import Joi from 'joi';

export const createEventSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  dateTime: Joi.date().iso().required(),
  location: Joi.string().required(),
  maxAttendees: Joi.number().integer().min(1).required(),
  categoryId: Joi.string().required(),
  paymentRequired: Joi.boolean().default(false),
  status: Joi.string().valid('SCHEDULED','COMPLETED','CANCELED').default('SCHEDULED')
});

export const updateEventSchema = createEventSchema.fork(
  ['title','description','dateTime','location','maxAttendees','categoryId','paymentRequired','status'],
  s => s.optional()
);
```

9) src/validations/registration.js
```js
import Joi from 'joi';

export const registrationSchema = Joi.object({
  eventId: Joi.string().required()
});
```

10) src/validations/payment.js
```js
import Joi from 'joi';

export const paymentSchema = Joi.object({
  eventId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  paymentMethodId: Joi.string().required() // Stripe payment method/id from client
});
```

11) src/services/mailer.js
```js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendMail({ to, subject, html }) {
  if (!to) return;
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}

export function registrationEmail({ username, eventTitle, dateTime }) {
  return {
    subject: `Registration confirmed: ${eventTitle}`,
    html: `<p>Hi ${username},</p>
           <p>You are registered for <b>${eventTitle}</b> on <b>${new Date(dateTime).toLocaleString()}</b>.</p>
           <p>See you there!</p>`,
  };
}
```

12) src/services/payments.js
```js
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

export async function createPayment({ amount, currency = 'usd', paymentMethodId, confirm = true }) {
  // amount in cents
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
    payment_method: paymentMethodId,
    confirm,
  });
  return paymentIntent;
}
```

13) src/routes/auth.js
```js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { registerSchema, loginSchema } from '../validations/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { error, value } = registerSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  const exists = await prisma.user.findFirst({
    where: { OR: [{ email: value.email }, { username: value.username }] }
  });
  if (exists) return res.status(409).json({ message: 'Email or username already exists' });

  const passwordHash = await bcrypt.hash(value.password, 10);
  const user = await prisma.user.create({
    data: {
      username: value.username,
      email: value.email,
      passwordHash,
      role: value.role
    },
    select: { id: true, username: true, email: true, role: true }
  });

  return res.status(201).json(user);
});

router.post('/login', async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  const user = await prisma.user.findUnique({ where: { email: value.email } });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(value.password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return res.json({ token, user: { id: user.id, email: user.email, username: user.username, role: user.role } });
});

export default router;
```

14) src/routes/events.js
```js
import { Router } from 'express';
import { prisma } from '../prisma.js';
import { authRequired, currentUser } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
import { createEventSchema, updateEventSchema } from '../validations/event.js';

const router = Router();

// GET all events (filters optional)
router.get('/', async (req, res) => {
  const { categoryId, status, organizerId } = req.query;
  const where = {};
  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status;
  if (organizerId) where.organizerId = organizerId;

  const events = await prisma.event.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { category: true, organizer: { select: { id: true, username: true } } }
  });
  res.json(events);
});

// GET event by id
router.get('/:id', async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { category: true, organizer: { select: { id: true, username: true } } }
  });
  if (!event) return res.status(404).json({ message: 'Not found' });
  res.json(event);
});

// POST create (ORGANIZER, ADMIN)
router.post('/', authRequired, currentUser, authorize('ORGANIZER','ADMIN'), async (req, res) => {
  const { error, value } = createEventSchema.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ message: 'Validation error', details: error.details });

  // Ensure category exists
  const category = await prisma.category.findUnique({ where: { id: value.categoryId } });
  if (!category) return res.status(400).json({ message: 'Invalid categoryId' });

  const event = await prisma.event.create({
    data: {
      ...value,
      organizerId: req.user.id
    }
  });
  res.status(201).json(event);
});

// PUT update (only organizer owner or ADMIN)
router.put('/:id', authRequired, currentUser, authorize('ORGANIZER','ADMIN'), async (req, res) => {
  const { error, value } = updateEventSchema.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ message: 'Validation error', details: error.details });

  const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });

  if (req.user.role !== 'ADMIN' && existing.organizerId !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const event = await prisma.event.update({
    where: { id: existing.id },
    data: value
  });
  res.json(event);
});

// DELETE (ADMIN only)
router.delete('/:id', authRequired, authorize('ADMIN'), async (req, res) => {
  const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });

  // cascade delete registrations & transactions
  await prisma.registration.deleteMany({ where: { eventId: existing.id } });
  await prisma.paymentTransaction.deleteMany({ where: { eventId: existing.id } });
  await prisma.event.delete({ where: { id: existing.id } });
  res.json({ message: 'Deleted' });
});

export default router;
```

15) src/routes/registrations.js
```js
import { Router } from 'express';
import { prisma } from '../prisma.js';
import { authRequired, currentUser } from '../middleware/auth.js';
import { registrationSchema } from '../validations/registration.js';
import { sendMail, registrationEmail } from '../services/mailer.js';

const router = Router();

// POST register to event (ATTENDEE)
router.post('/', authRequired, currentUser, async (req, res) => {
  const { error, value } = registrationSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  const event = await prisma.event.findUnique({ where: { id: value.eventId } });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  const count = await prisma.registration.count({ where: { eventId: event.id } });
  if (count >= event.maxAttendees) return res.status(400).json({ message: 'Event is full' });

  const existing = await prisma.registration.findFirst({
    where: { userId: req.user.id, eventId: event.id }
  });
  if (existing) return res.status(409).json({ message: 'Already registered' });

  const registration = await prisma.registration.create({
    data: {
      userId: req.user.id,
      eventId: event.id,
      paymentStatus: event.paymentRequired ? 'PENDING' : 'PAID'
    }
  });

  // Send email confirmation (if free or once paid later)
  if (!event.paymentRequired) {
    const email = registrationEmail({ username: req.userEntity.username, eventTitle: event.title, dateTime: event.dateTime });
    await sendMail({ to: req.userEntity.email, ...email });
  }

  res.status(201).json(registration);
});

// GET registrations for user
router.get('/:userId', authRequired, async (req, res) => {
  if (req.user.role !== 'ADMIN' && req.user.id !== req.params.userId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const regs = await prisma.registration.findMany({
    where: { userId: req.params.userId },
    include: { event: true }
  });
  res.json(regs);
});

// DELETE registration (cancel)
router.delete('/:id', authRequired, async (req, res) => {
  const reg = await prisma.registration.findUnique({ where: { id: req.params.id } });
  if (!reg) return res.status(404).json({ message: 'Not found' });
  if (req.user.role !== 'ADMIN' && req.user.id !== reg.userId) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  await prisma.registration.delete({ where: { id: reg.id } });
  res.json({ message: 'Canceled' });
});

export default router;
```

16) src/routes/payments.js
```js
import { Router } from 'express';
import { prisma } from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { paymentSchema } from '../validations/payment.js';
import { createPayment } from '../services/payments.js';
import { sendMail, registrationEmail } from '../services/mailer.js';

const router = Router();

// POST process payment (Stripe PaymentIntent)
router.post('/', authRequired, async (req, res) => {
  const { error, value } = paymentSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  const event = await prisma.event.findUnique({ where: { id: value.eventId } });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (!event.paymentRequired) return res.status(400).json({ message: 'Event is free' });

  // Create payment
  const intent = await createPayment({
    amount: value.amount,
    paymentMethodId: value.paymentMethodId
  });

  const status = intent.status === 'succeeded' ? 'SUCCESS' : 'FAILED';
  const tx = await prisma.paymentTransaction.create({
    data: {
      userId: req.user.id,
      eventId: event.id,
      amount: value.amount,
      status,
      provider: 'stripe',
      providerRef: intent.id
    }
  });

  // If success -> mark registration as PAID (create if missing)
  if (status === 'SUCCESS') {
    const reg = await prisma.registration.upsert({
      where: { userId_eventId: { userId: req.user.id, eventId: event.id } },
      update: { paymentStatus: 'PAID' },
      create: { userId: req.user.id, eventId: event.id, paymentStatus: 'PAID' }
    });

    // Send confirmation
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user) {
      const email = registrationEmail({ username: user.username, eventTitle: event.title, dateTime: event.dateTime });
      await sendMail({ to: user.email, ...email });
    }

    return res.json({ transaction: tx, registration: reg });
  }

  return res.status(402).json({ message: 'Payment failed', transaction: tx });
});

export default router;
```

17) src/routes/notifications.js
```js
import { Router } from 'express';
import { prisma } from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
import { sendMail } from '../services/mailer.js';

const router = Router();

// POST notify attendees (ADMIN or organizer of that event)
router.post('/', authRequired, authorize('ADMIN','ORGANIZER'), async (req, res) => {
  const { eventId, message } = req.body;
  if (!eventId || !message) return res.status(400).json({ message: 'eventId and message required' });

  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { organizer: true } });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (req.user.role !== 'ADMIN' && event.organizerId !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const regs = await prisma.registration.findMany({
    where: { eventId },
    include: { user: true }
  });

  await Promise.all(regs.map(async r => {
    await prisma.notification.create({
      data: { userId: r.userId, eventId, message }
    });
    await sendMail({
      to: r.user.email,
      subject: `Update for ${event.title}`,
      html: `<p>${message}</p>`
    });
  }));

  res.json({ count: regs.length });
});

export default router;
```

18) src/routes/admin.js
```js
import { Router } from 'express';
import { prisma } from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = Router();

// Basic dashboard metrics
router.get('/dashboard', authRequired, authorize('ADMIN','ORGANIZER'), async (req, res) => {
  const [eventsCount, usersCount, regsCount] = await Promise.all([
    prisma.event.count(),
    prisma.user.count(),
    prisma.registration.count(),
  ]);

  // Organizer-scoped stats if organizer
  if (req.user.role === 'ORGANIZER') {
    const myEvents = await prisma.event.findMany({ where: { organizerId: req.user.id } });
    const myEventIds = myEvents.map(e => e.id);
    const myRegs = await prisma.registration.count({ where: { eventId: { in: myEventIds } } });

    return res.json({
      role: 'ORGANIZER',
      eventsCount: myEvents.length,
      registrationsCount: myRegs
    });
  }

  res.json({ role: 'ADMIN', eventsCount, usersCount, registrationsCount: regsCount });
});

export default router;
```

19) src/app.js
```js
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import registrationRoutes from './routes/registrations.js';
import paymentRoutes from './routes/payments.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/registrations', registrationRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);

  // Not found
  app.use((req, res) => res.status(404).json({ message: 'Not found' }));
  return app;
}
```

20) src/index.js
```js
import 'dotenv/config';
import { createApp } from './app.js';

const port = process.env.PORT || 8080;
const app = createApp();
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
```

How to run
- Install and run SQL Server (or switch to Postgres by changing provider + DATABASE_URL).
- npm i
- npx prisma generate
- npm run prisma:migrate
- npm run dev

API summary (matches your spec)
- Auth
  - POST /api/auth/register
  - POST /api/auth/login
- Events
  - GET /api/events
  - GET /api/events/:id
  - POST /api/events (ORGANIZER/ADMIN)
  - PUT /api/events/:id (Organizer owner or ADMIN)
  - DELETE /api/events/:id (ADMIN)
- Registrations
  - POST /api/registrations (ATTENDEE; free events auto-PAID, paid PENDING)
  - GET /api/registrations/:userId (self or ADMIN)
  - DELETE /api/registrations/:id (self or ADMIN)
- Payments
  - POST /api/payments (Stripe PaymentIntent; on success -> mark registration PAID)
- Notifications
  - POST /api/notifications (ADMIN/Organizer of that event): sends emails + stores notifications
- Admin/Organizer dashboard
  - GET /api/admin/dashboard

Switching DB
- To use Postgres, in schema.prisma change provider to "postgresql", update DATABASE_URL, rerun migrations.

Next steps
- Add rate limiting (express-rate-limit).
- Add refresh tokens/rotation if you want longer sessions.
- Harden CORS and security headers (helmet).
- Add Swagger (OpenAPI) docs.

If you want, I can also add a Docker Compose with SQL Server and wire Stripe webhooks to finalize payments asynchronously. -->