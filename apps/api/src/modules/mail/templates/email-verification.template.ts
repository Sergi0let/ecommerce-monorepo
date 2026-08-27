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

export function renderEmailVerification(
  verificationUrl: string,
): RenderedEmail {
  const safeUrl = escapeHtml(verificationUrl);

  return {
    subject: 'Verify your Market Cosmo email',
    text: [
      'Verify your email address for Market Cosmo.',
      '',
      `Open this link: ${verificationUrl}`,
      '',
      'The link expires in 24 hours.',
    ].join('\n'),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f6f7f9;padding:32px;font-family:Arial,sans-serif;color:#172033">
    <main style="max-width:600px;margin:auto;background:#fff;border-radius:12px;padding:40px">
      <h1 style="margin:0 0 16px;font-size:24px">Verify your email</h1>
      <p style="margin:0 0 24px;line-height:1.5">
        Confirm your email address to activate your Market Cosmo account.
      </p>
      <a
        href="${safeUrl}"
        style="display:inline-block;background:#172033;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none"
      >
        Verify email
      </a>
      <p style="margin:24px 0 0;color:#667085;font-size:14px;line-height:1.5">
        This link expires in 24 hours. If you did not create an account, ignore this email.
      </p>
    </main>
  </body>
</html>`,
  };
}
