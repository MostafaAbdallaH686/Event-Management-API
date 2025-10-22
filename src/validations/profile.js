import Joi from 'joi';

export const updateProfileSchema = Joi.object({
  fullName: Joi.string().max(255).optional().allow(''),
  bio: Joi.string().max(1000).optional().allow(''),
  phone: Joi.string().pattern(/^[\d\s\-\+KATEX_INLINE_OPENKATEX_INLINE_CLOSE]+$/).max(20).optional().allow(''),  // Fixed regex
  location: Joi.string().max(255).optional().allow(''),
  website: Joi.string().uri().max(255).optional().allow(''),
  username: Joi.string().alphanum().min(3).max(30).optional(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
  confirmPassword: Joi.ref('newPassword')
}).with('newPassword', 'confirmPassword');