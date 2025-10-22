import Stripe from 'stripe';

class PaymentService {
  constructor() {
    this.stripe = null;
    this.useMock = true;

    // Initialize Stripe if we have a valid key
    if (process.env.STRIPE_SECRET_KEY && 
        process.env.STRIPE_SECRET_KEY !== 'sk_test_...' && 
        process.env.USE_MOCK_PAYMENTS !== 'true') {
      try {
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { 
          apiVersion: '2024-06-20' 
        });
        this.useMock = false;
        console.log('✅ Stripe initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize Stripe:', error.message);
        console.log('📝 Using mock payments instead');
      }
    } else {
      console.log('📝 Using mock payment system (no Stripe key configured)');
    }
  }

  async createPayment({ amount, currency = 'usd', paymentMethodId, metadata = {} }) {
    if (this.useMock) {
      return this.createMockPayment({ amount, paymentMethodId });
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata,
        // Option 1: Use payment_method and confirm separately
        ...(paymentMethodId.startsWith('pm_') ? {
          payment_method: paymentMethodId,
          confirm: true,
          automatic_payment_methods: {
            enabled: false, // Disable automatic payment methods when using specific payment_method
          }
        } : {
          // Option 2: For card tokens or other payment methods
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never'
          },
          confirm: false // Don't auto-confirm, let frontend handle it
        })
      });

      return paymentIntent;
    } catch (error) {
      console.error('Stripe API error:', error);
      throw new Error(`Stripe payment failed: ${error.message}`);
    }
  }

  async createMockPayment({ amount, paymentMethodId }) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Determine success based on payment method ID
    let status = 'succeeded';
    if (paymentMethodId.includes('decline') || paymentMethodId === 'pm_card_visa_chargeDeclined') {
      status = 'requires_payment_method';
    } else if (paymentMethodId.includes('auth') || paymentMethodId === 'pm_card_authenticationRequired') {
      status = 'requires_action';
    }
    
    return {
      id: `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status,
      amount: Math.round(amount * 100),
      currency: 'usd',
      payment_method: paymentMethodId,
      client_secret: `mock_secret_${Date.now()}` // Mock client secret
    };
  }

  isUsingMock() {
    return this.useMock;
  }
}

// Export singleton instance
const paymentService = new PaymentService();
export default paymentService;
export const createPayment = (params) => paymentService.createPayment(params);