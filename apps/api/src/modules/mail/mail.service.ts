import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { RenderedEmail, SendMailInput } from './mail.types';
import { renderEmailVerification } from './templates/email-verification.template';
import { renderPasswordReset } from './templates/password-reset.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const port = Number(this.configService.getOrThrow<string>('SMTP_PORT'));
    const secureValue = this.configService.getOrThrow<string>('SMTP_SECURE');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');

    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error('SMTP_PORT must be a valid port number');
    }

    if (secureValue !== 'true' && secureValue !== 'false') {
      throw new Error('SMTP_SECURE must be either true or false');
    }

    if (Boolean(smtpUser) !== Boolean(smtpPassword)) {
      throw new Error(
        'SMTP_USER and SMTP_PASSWORD must be configured together',
      );
    }

    this.from = this.configService.getOrThrow<string>('MAIL_FROM');

    this.transporter = createTransport({
      host: this.configService.getOrThrow<string>('SMTP_HOST'),
      port,
      secure: secureValue === 'true',
      ...(smtpUser && smtpPassword
        ? {
            auth: {
              user: smtpUser,
              pass: smtpPassword,
            },
          }
        : {}),
    });
  }

  async sendEmailVerification(input: SendMailInput): Promise<void> {
    await this.send(
      input,
      renderEmailVerification(input.actionUrl),
      'Email verification',
    );
  }

  async sendPasswordReset(input: SendMailInput): Promise<void> {
    await this.send(
      input,
      renderPasswordReset(input.actionUrl),
      'Password reset',
    );
  }

  private async send(
    input: SendMailInput,
    email: RenderedEmail,
    emailType: string,
  ): Promise<void> {
    try {
      const result = await this.transporter.sendMail({
        from: this.from,
        to: input.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      this.logger.debug(`${emailType} email delivered: ${result.messageId}`);
    } catch (error) {
      const category = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(`${emailType} email delivery failed: ${category}`);

      throw new ServiceUnavailableException(
        'Email delivery is temporarily unavailable',
      );
    }
  }
}
