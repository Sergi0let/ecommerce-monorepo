import type { RenderedEmail } from '../mail.types';

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  );

export function renderPasswordReset(verificationUrl: string): RenderedEmail {
  const safeUrl = escapeHtml(verificationUrl);

  return {
    subject: 'Reset your Market Cosmo password',
    text: [
      'You have requested to reset your Market Cosmo password.',
      '',
      `Open this link: ${verificationUrl}`,
      '',
      'The link expires in 15min.',
    ].join('\n'),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f6f7f9;padding:32px;font-family:Arial,sans-serif;color:#172033">
    <main style="max-width:600px;margin:auto;background:#fff;border-radius:12px;padding:40px">
      <h1 style="margin:0 0 16px;font-size:24px">Reset your password</h1>
      <p style="margin:0 0 24px;line-height:1.5">
        You have requested to reset your Market Cosmo password.
      </p>
      <a
        href="${safeUrl}"
        style="display:inline-block;background:#172033;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none"
      >
        Reset password
      </a>
      <p style="margin:24px 0 0;color:#667085;font-size:14px;line-height:1.5">
        This link expires in 24 hours. If you did not create an account, ignore this email.
      </p>
    </main>
  </body>
</html>`,
  };
}
