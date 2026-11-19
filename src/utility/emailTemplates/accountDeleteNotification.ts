export default function accountDeleteNotification(userName: string, userEmail: string) {
  return `
  <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Deletion Request – SFPL</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">

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
                    <span style="font-size: 10px; color: #666666; letter-spacing: 0.08em; text-transform: uppercase;">account notice</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero section -->
          <tr>
            <td style="background-color: #111111; padding: 40px 36px 36px 36px; text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <div style="display: inline-block; background-color: #fb2c37; width: 56px; height: 56px; border-radius: 50%; text-align: center; line-height: 56px; font-size: 24px;">
                      🗑️
                    </div>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0 0 10px 0; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em; line-height: 1.2;">
                Account Deletion Requested
              </h1>
              <p style="margin: 0 auto; font-size: 14px; color: #aaaaaa; line-height: 1.6; max-width: 380px;">
                We've received a deletion request for your SFPL account. Your data will be permanently removed after a 15-day grace period.
              </p>
            </td>
          </tr>

          <!-- Red divider -->
          <tr>
            <td style="background-color: #fb2c37; height: 2px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 36px;">

              <!-- Greeting -->
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #111111; line-height: 1.6;">
                Hello <strong>${userName}</strong>,
              </p>

              <!-- Account info box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background-color: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 6px 0; font-size: 10px; color: #999999; letter-spacing: 0.12em; text-transform: uppercase;">Account registered for deletion</p>
                    <p style="margin: 0; font-size: 15px; font-weight: 700; color: #111111; font-family: 'Courier New', Courier, monospace; letter-spacing: 0.04em;">${userEmail}</p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 14px; color: #333333; line-height: 1.7;">
                Your account deletion request has been registered successfully. Your account and all associated data will be <strong>permanently deleted 15 days</strong> from the date of this email.
              </p>

              <p style="margin: 0 0 28px 0; font-size: 14px; color: #333333; line-height: 1.7;">
                During this period, your account remains accessible and no data will be removed. If this was a mistake or you change your mind, you can recover your account by contacting us before the deadline.
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top: 1px solid #eeeeee; padding-bottom: 28px; font-size: 0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Recovery section -->
              <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 700; color: #111111; letter-spacing: 0.04em; text-transform: uppercase;">
                Want to recover your account?
              </p>

              <!-- Contact: Email -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 14px; width: 32px;">
                    <div style="background-color: #000000; width: 32px; height: 32px; border-radius: 50%; text-align: center; line-height: 32px; font-size: 14px;">
                      ✉️
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <p style="margin: 0; font-size: 11px; color: #999999; text-transform: uppercase; letter-spacing: 0.08em;">Email us</p>
                    <a href="mailto:contact@specificfire.com" style="font-size: 14px; color: #fb2c37; text-decoration: none; font-weight: 600;">contact@specificfire.com</a>
                  </td>
                </tr>
              </table>

              <!-- Contact: Phone -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 14px; width: 32px;">
                    <div style="background-color: #000000; width: 32px; height: 32px; border-radius: 50%; text-align: center; line-height: 32px; font-size: 14px;">
                      📞
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <p style="margin: 0; font-size: 11px; color: #999999; text-transform: uppercase; letter-spacing: 0.08em;">Call us</p>
                    <a href="tel:+919033050415" style="font-size: 14px; color: #333333; text-decoration: none; font-weight: 600;">+91 90330 50415</a>
                  </td>
                </tr>
              </table>

              <!-- Warning notice -->
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
                            <strong style="display: block; margin-bottom: 4px; color: #c00;">Permanent deletion after 15 days</strong>
                            Once deleted, your account and all data cannot be recovered. If you did not request this deletion, please contact us immediately.
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

      </td>
    </tr>
  </table>

</body>
</html>
`;
}
