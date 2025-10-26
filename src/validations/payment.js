import Joi from 'joi';

export const paymentSchema = Joi.object({
  eventId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  paymentMethodId: Joi.string().required() // e.g., Stripe Payment Method ID
});