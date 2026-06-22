const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  refreshTokenSchema
} = require('../validators/authValidator');

const validate = {
  register: (data) => registerSchema.validate(data, { abortEarly: true }),
  login: (data) => loginSchema.validate(data, { abortEarly: true }),
  forgotPassword: (data) => forgotPasswordSchema.validate(data, { abortEarly: true }),
  resetPassword: (data) => resetPasswordSchema.validate(data, { abortEarly: true }),
  changePassword: (data) => changePasswordSchema.validate(data, { abortEarly: true }),
  verifyEmail: (data) => verifyEmailSchema.validate(data, { abortEarly: true }),
  resendVerification: (data) => resendVerificationSchema.validate(data, { abortEarly: true }),
  refreshToken: (data) => refreshTokenSchema.validate(data, { abortEarly: true })
};

module.exports = { validate };
