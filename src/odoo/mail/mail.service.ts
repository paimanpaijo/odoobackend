import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import * as fs from 'fs';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendMail(data: any) {
    try {
      const mailOptions: any = {
        to: data.to,
        subject: data.subject,
        html: data.html,
      };

      // optional cc & bcc
      if (data.cc) mailOptions.cc = data.cc;
      if (data.bcc) mailOptions.bcc = data.bcc;

      // optional attachment (AMAN 🔥)
      if (data.attachments?.length) {
        mailOptions.attachments = data.attachments.filter((att) => {
          if (att.path && !fs.existsSync(att.path)) {
            console.warn(`File not found: ${att.path}`);
            return false;
          }
          return true;
        });
      }

      return await this.mailerService.sendMail(mailOptions);
    } catch (error) {
      console.error('MAIL ERROR:', error);
      throw error;
    }
  }
}