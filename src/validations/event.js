import Joi from 'joi';

// Helper function for flexible URL validation
const flexibleUrlSchema = () => {
  return Joi.string().custom((value, helpers) => {
    if (!value) return value;
    
    // Accept full URLs
    if (value.match(/^https?:\/\//)) {
      try {
        new URL(value);
        return value;
      } catch {
        return helpers.error('string.uri');
      }
    }
    
    // Accept relative paths
    if (value.startsWith('/')) {
      return value;
    }
    
    return helpers.error('string.uri');
  }, 'flexible URL validation');
};

export const createEventSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255).required(),
  description: Joi.string().trim().min(10).required(),
  imageUrl: flexibleUrlSchema().optional().allow('', null),
  thumbnailUrl: flexibleUrlSchema().optional().allow('', null), // Add this
  dateTime: Joi.date().iso().min('now').required(),
  location: Joi.string().trim().min(3).max(255).required(),
  maxAttendees: Joi.number().integer().min(1).max(10000).required(),
  categoryId: Joi.string().required(),
  paymentRequired: Joi.boolean().default(false),
  status: Joi.string().valid('SCHEDULED', 'COMPLETED', 'CANCELED').default('SCHEDULED')
}).options({ stripUnknown: true }); // Strip unknown fields

export const updateEventSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255).optional(),
  description: Joi.string().trim().min(10).optional(),
  imageUrl: flexibleUrlSchema().optional().allow('', null),
  thumbnailUrl: flexibleUrlSchema().optional().allow('', null),
  dateTime: Joi.date().iso().optional(),
  location: Joi.string().trim().min(3).max(255).optional(),
  maxAttendees: Joi.number().integer().min(1).max(10000).optional(),
  categoryId: Joi.string().optional(),
  paymentRequired: Joi.boolean().optional(),
  status: Joi.string().valid('SCHEDULED', 'COMPLETED', 'CANCELED').optional()
}).options({ stripUnknown: true });