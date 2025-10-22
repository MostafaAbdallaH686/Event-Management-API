import { Router } from 'express';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { paymentSchema } from '../validations/payment.js';
import paymentService from '../services/payments.js';
import { sendMail, registrationEmail } from '../services/mailer.js';
import { randomUUID } from 'crypto';

const router = Router();

// GET payment configuration
router.get('/config', (req, res) => {
  const usingMock = paymentService.isUsingMock();
  
  res.json({
    provider: usingMock ? 'mock' : 'stripe',
    testMode: true,
    publishableKey: !usingMock ? process.env.STRIPE_PUBLISHABLE_KEY : null,
    testCards: [
      { id: 'pm_card_visa', type: 'Success', description: 'Always succeeds' },
      { id: 'pm_card_visa_chargeDeclined', type: 'Decline', description: 'Always declines' },
      { id: 'pm_card_authenticationRequired', type: '3D Secure', description: 'Requires authentication' }
    ]
  });
});

// POST process payment
router.post('/', authRequired, async (req, res) => {
  try {
    const { error, value } = paymentSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    // Get event
    const event = await prisma.events.findUnique({ where: { id: value.eventId } });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!event.paymentRequired) return res.status(400).json({ message: 'Event is free' });

    // Check if already registered and paid
    const existingPaidReg = await prisma.registrations.findFirst({
      where: {
        userId: req.user.id,
        eventId: event.id,
        paymentStatus: 'PAID'
      }
    });
    
    if (existingPaidReg) {
      return res.status(400).json({ message: 'Already registered and paid for this event' });
    }

    // Process payment
    let intent;
    try {
      intent = await paymentService.createPayment({
        amount: value.amount,
        paymentMethodId: value.paymentMethodId,
        metadata: {
          userId: req.user.id,
          eventId: event.id,
          eventTitle: event.title
        }
      });
    } catch (paymentError) {
      console.error('Payment processing error:', paymentError);
      return res.status(400).json({ 
        message: 'Payment processing failed',
        error: paymentError.message,
        usingMock: paymentService.isUsingMock()
      });
    }

    // Determine payment status
    const isSuccessful = intent.status === 'succeeded';
    const status = isSuccessful ? 'SUCCESS' : 'FAILED';
    
    // Record transaction
    const tx = await prisma.payment_transactions.create({
      data: {
        id: randomUUID(),
        userId: req.user.id,
        eventId: event.id,
        amount: value.amount,
        status,
        provider: paymentService.isUsingMock() ? 'mock' : 'stripe',
        providerRef: intent.id
      }
    });

    // If success -> create/update registration
    if (isSuccessful) {
      // Find or create registration
      const existingReg = await prisma.registrations.findFirst({
        where: {
          userId: req.user.id,
          eventId: event.id
        }
      });

      const reg = existingReg 
        ? await prisma.registrations.update({
            where: { id: existingReg.id },
            data: { paymentStatus: 'PAID' }
          })
        : await prisma.registrations.create({
            data: {
              id: randomUUID(),
              userId: req.user.id,
              eventId: event.id,
              paymentStatus: 'PAID'
            }
          });

      // Send confirmation email
      const user = await prisma.users.findUnique({ where: { id: req.user.id } });
      if (user) {
        const email = registrationEmail({ 
          username: user.username, 
          eventTitle: event.title, 
          dateTime: event.dateTime 
        });
        await sendMail({ to: user.email, ...email }).catch(console.error);
      }

      return res.json({ 
        success: true,
        message: 'Payment successful',
        transaction: tx, 
        registration: reg,
        paymentIntent: {
          id: intent.id,
          clientSecret: intent.client_secret
        }
      });
    }

    // Payment requires further action or failed
    if (intent.status === 'requires_action' || intent.status === 'requires_payment_method') {
      return res.json({
        success: false,
        requiresAction: true,
        message: 'Payment requires additional authentication',
        clientSecret: intent.client_secret,
        transaction: tx
      });
    }

    return res.status(402).json({ 
      success: false,
      message: 'Payment failed', 
      transaction: tx,
      status: intent.status
    });
  } catch (err) {
    console.error('Payment endpoint error:', err);
    return res.status(500).json({ 
      message: 'Internal server error', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// GET payment history
router.get('/history', authRequired, async (req, res) => {
  try {
    const transactions = await prisma.payment_transactions.findMany({
      where: { userId: req.user.id },
      orderBy: { transactionDate: 'desc' },
      include: {
        events: {
          select: {
            id: true,
            title: true,
            dateTime: true,
            location: true
          }
        }
      },
      take: 20 // Limit to last 20 transactions
    });
    
    res.json(transactions);
  } catch (err) {
    console.error('Error fetching payment history:', err);
    res.status(500).json({ message: 'Failed to fetch payment history' });
  }
});

export default router;