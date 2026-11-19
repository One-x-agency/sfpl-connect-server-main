export default function emailVerifyOtp(otp: string) {
  return `
  <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification – SFPL</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f0f0; padding: 40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="max-width: 580px; background-color: #ffffff; border-radius: 4px; overflow: hidden; border: 1px solid #e0e0e0;">

          <!-- Red top accent bar -->
          <tr>
            <td style="background-color: #fb2c37; height: 5px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header: Logo area -->
          <tr>
            <td style="background-color: #000000; padding: 28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align: middle; width: 99px">
                          <img src="https://specificfire.com/fave.svg" alt="SFPL" width="76" height="36"
                            style="display: block;" />
                        </td>
                        <td style="vertical-align: middle;">
                          <span style="font-size: 13px; font-weight: 700; color: #ffffff; letter-spacing: 0.12em; text-transform: uppercase; line-height: 1.2; display: block;">
                            Specific Fire Protection
                          </span>
                          <span style="font-size: 11px; font-weight: 400; color: #fb2c37; letter-spacing: 0.1em; text-transform: uppercase; display: block; margin-top: 2px;">
                            Limited
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="font-size: 10px; color: #666666; letter-spacing: 0.08em; text-transform: uppercase;">Security Notice</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero section: dark banner with heading -->
          <tr>
            <td style="background-color: #111111; padding: 40px 36px 36px 36px; text-align: center;">
              <div style="margin-bottom: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center">
                      <div style="display: inline-block; background-color: #fb2c37; width: 56px; height: 56px; border-radius: 50%; text-align: center; line-height: 56px; font-size: 26px;">
                        🔒
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
              <h1 style="margin: 0 0 10px 0; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em; line-height: 1.2;">
                Verify Your Email
              </h1>
              <p style="margin: 0; font-size: 14px; color: #aaaaaa; line-height: 1.6; max-width: 380px; margin: 0 auto;">
                Use the One Time Password below to verify your email address for your SFPL account.
              </p>
            </td>
          </tr>

          <!-- Divider line -->
          <tr>
            <td style="background-color: #fb2c37; height: 2px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 36px;">

              <!-- OTP label -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 10px;">
                    <p style="margin: 0; font-size: 10px; color: #999999; letter-spacing: 0.12em; text-transform: uppercase;">
                      Your One Time Password
                    </p>
                  </td>
                </tr>
              </table>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <div style="display: inline-block; background-color: #f8f8f8; border: 2px solid #000000; border-radius: 4px; padding: 20px 40px;">
                      <span style="font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #111111; font-family: 'Courier New', Courier, monospace;">
                        ${otp}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top: 1px solid #eeeeee; padding-bottom: 28px; font-size: 0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Security notice box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background-color: #fff5f5; border-left: 3px solid #fb2c37; border-radius: 2px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align: top; padding-right: 12px; font-size: 16px; line-height: 1;">
                          ⚠️
                        </td>
                        <td>
                          <p style="margin: 0; font-size: 13px; color: #7f1d1d; line-height: 1.6;">
                            <strong style="display: block; margin-bottom: 4px; color: #c00;">Code expires in 10 minutes</strong>
                            For your security, do not share this OTP with anyone — including SFPL staff. If you didn't request this, please ignore this email or contact our support team.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #000000; padding: 20px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <p style="margin: 0; font-size: 11px; color: #666666; line-height: 1.6;">
                      This is an automated message from<br>
                      <span style="color: #aaaaaa;">Specific Fire Protection Limited</span><br>
                      105, IIT Gandhinagar Research Park, Gandhinagar, Gujarat
                    </p>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <p style="margin: 0; font-size: 11px; color: #555555; text-align: right; line-height: 1.8;">
                      <a href="mailto:contact@specificfire.com" style="color: #fb2c37; text-decoration: none; display: block;">contact@specificfire.com</a>
                      <a href="tel:+919033050415" style="color: #888888; text-decoration: none; display: block;">+91 90330 50415</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 16px;">
                    <p style="margin: 0; font-size: 10px; color: #444444; border-top: 1px solid #222222; padding-top: 12px; text-align: center; letter-spacing: 0.04em;">
                      © 2025 Specific Fire Protection Limited. All rights reserved. · Do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- End card -->

      </td>
    </tr>
  </table>

</body>
</html>
  `;
}
