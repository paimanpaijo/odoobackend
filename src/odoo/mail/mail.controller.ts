import { Controller, Post, Body } from '@nestjs/common';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';

@Controller()
export class MailController {
  constructor(private mailService: MailService) {}

  @Post('send')
  async send(@Body() body: SendMailDto) {
    await this.mailService.sendMail(body);

    return {
      status: 200,
      success: true,
      message: 'Email sent successfully',
    };
  }
}
