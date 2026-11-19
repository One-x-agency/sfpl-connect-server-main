import { Router } from 'express';
import withDatabase from '@/core/withDatabase.js';
import validate from '@/middleware/requestValidator.js';
import requireCustomerAuth from '@/middleware/auth/requireCustomerAuth.js';

import { Controller as registerCustomer, ValidationSchema as registerCustomerValidationSchema } from '@/modules/customer-portal/auth/controllers/registerCustomer.js';
import { Controller as verifyCustomerRegistration, ValidationSchema as verifyCustomerRegistrationValidationSchema } from '@/modules/customer-portal/auth/controllers/verifyCustomerRegistration.js';
import { Controller as resendRegistrationOtpCustomer, ValidationSchema as resendRegistrationOtpCustomerValidationSchema } from '@/modules/customer-portal/auth/controllers/resendRegistrationOtp.js';
import { Controller as loginCustomer, ValidationSchema as loginCustomerValidationSchema } from '@/modules/customer-portal/auth/controllers/loginCustomer.js';
import { Controller as forgotPasswordWithOtpCustomer, ValidationSchema as forgotPasswordWithOtpCustomerValidationSchema } from '@/modules/customer-portal/auth/controllers/forgotPasswordWithOtp.js';
import { Controller as verifyForgotPasswordOtpCustomer, ValidationSchema as verifyForgotPasswordOtpCustomerValidationSchema } from '@/modules/customer-portal/auth/controllers/verifyForgotPasswordOtp.js';
import { Controller as resendForgotPasswordOtpCustomer, ValidationSchema as resendForgotPasswordOtpCustomerValidationSchema } from '@/modules/customer-portal/auth/controllers/resendForgotPasswordOtp.js';
import { Controller as resetPasswordCustomer, ValidationSchema as resetPasswordCustomerValidationSchema } from '@/modules/customer-portal/auth/controllers/resetPassword.js';
import { Controller as changePasswordCustomer, ValidationSchema as changePasswordCustomerValidationSchema } from '@/modules/customer-portal/auth/controllers/changePassword.js';
import { Controller as deleteAccountCustomer, ValidationSchema as deleteAccountCustomerValidationSchema } from '@/modules/customer-portal/auth/controllers/deleteAccount.js';
import { Controller as getProfile, ValidationSchema as getProfileValidationSchema } from '@/modules/customer-portal/auth/controllers/getProfile.js';
import { Controller as refreshToken, ValidationSchema as refreshTokenValidationSchema } from '@/modules/customer-portal/auth/controllers/refersToken.js';
import { Controller as loginWithGoogle, ValidationSchema as loginWithGoogleValidationSchema } from '@/modules/customer-portal/auth/controllers/loginWithGoogle.js';
import { Controller as logoutCustomer } from '@/modules/customer-portal/auth/controllers/logoutCustomer.js';
import { Controller as updateCustomerProfile, ValidationSchema as updateCustomerProfileValidationSchema } from '@/modules/customer-portal/auth/controllers/updateCustomerProfile.js';
import { Controller as loginWithApple, ValidationSchema as loginWithAppleValidationSchema } from '@/modules/customer-portal/auth/controllers/loginWithApple.js';

const router = Router();

router.route('/register')
  .post(validate(registerCustomerValidationSchema), withDatabase(registerCustomer));

router.route('/verify-registration')
  .post(validate(verifyCustomerRegistrationValidationSchema), withDatabase(verifyCustomerRegistration));

router.route('/resend-registration-otp')
  .post(validate(resendRegistrationOtpCustomerValidationSchema), withDatabase(resendRegistrationOtpCustomer));

router.route('/login')
  .post(validate(loginCustomerValidationSchema), withDatabase(loginCustomer));

router.route('/login-with-google')
  .post(validate(loginWithGoogleValidationSchema), withDatabase(loginWithGoogle));

router.route('/login-with-apple')
  .post(validate(loginWithAppleValidationSchema), withDatabase(loginWithApple));

router.route('/forgot-password-otp')
  .post(validate(forgotPasswordWithOtpCustomerValidationSchema), withDatabase(forgotPasswordWithOtpCustomer));

router.route('/verify-forgot-password-otp')
  .post(validate(verifyForgotPasswordOtpCustomerValidationSchema), withDatabase(verifyForgotPasswordOtpCustomer));

router.route('/resend-forgot-password-otp')
  .post(validate(resendForgotPasswordOtpCustomerValidationSchema), withDatabase(resendForgotPasswordOtpCustomer));

router.route('/reset-password')
  .post(validate(resetPasswordCustomerValidationSchema), withDatabase(resetPasswordCustomer));

router.route('/change-password')
  .post(
    requireCustomerAuth,
    validate(changePasswordCustomerValidationSchema),
    withDatabase(changePasswordCustomer),
  );

router.route('/delete-account')
  .post(
    requireCustomerAuth,
    validate(deleteAccountCustomerValidationSchema),
    withDatabase(deleteAccountCustomer),
  );

router.route('/profile')
  .get(
    requireCustomerAuth,
    validate(getProfileValidationSchema),
    withDatabase(getProfile),
  )
  .put(
    requireCustomerAuth,
    validate(updateCustomerProfileValidationSchema),
    withDatabase(updateCustomerProfile),
  );

router.route('/logout')
  .post(withDatabase(logoutCustomer));

router.route('/refresh')
  .post(validate(refreshTokenValidationSchema), withDatabase(refreshToken));

export default router;
