import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async loginWithLaravel(credentials: { email: string; password: string }) {
    try {
      // 🔹 1. Login ke aplikasi Laravel
      const laravelUrl = process.env.LARAVEL_AUTH_URL as string;
      if (!laravelUrl)
        throw new Error('LARAVEL_AUTH_URL tidak ditemukan di .env');

      const { data } = await axios.post(laravelUrl, credentials);

      if (!data.success)
        throw new UnauthorizedException(data.message || 'Login gagal');

      const laravelToken = data.access_token;
      const user = data.user;

      // 🔹 2. Ambil employee_id dari Odoo
      const employeeId = await this.getEmployeeIdFromOdoo(user.email);

      if (!employeeId) {
        throw new UnauthorizedException('Employee tidak ditemukan di Odoo');
      }

      // 🔹 3. Buat token NestJS
      const nestPayload = {
        sub: user.id,
        email: user.email,
        employee_id: employeeId,
      };
      const nestToken = await this.jwtService.signAsync(nestPayload);

      // 🔹 4. Kembalikan dua token
      return {
        success: true,
        message: 'Login sukses',
        laravel_token: data.access_token,
        laravel_user: user,
        nest_token: nestToken,
        employee_id: employeeId,
      };
    } catch (error) {
      console.error(error.response?.data || error.message);
      throw new UnauthorizedException('Login gagal ke Laravel atau Odoo');
    }
  }

  private async getEmployeeIdFromOdoo(email: string) {
    try {
      const { data: login } = await axios.post(
        `${process.env.ODOO_URL}/web/session/authenticate`,
        {
          jsonrpc: '2.0',
          params: {
            db: process.env.ODOO_DB,
            login: process.env.ODOO_USER,
            password: process.env.ODOO_PASS,
          },
        },
      );

      const sessionId = login.result?.session_id;
      if (!sessionId) throw new Error('Login ke Odoo gagal');

      const { data: employeeData } = await axios.post(
        `${process.env.ODOO_URL}/web/dataset/call_kw`,
        {
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'hr.employee',
            method: 'search_read',
            args: [[['work_email', '=', email]], ['id', 'name']],
            kwargs: { limit: 1 },
          },
        },
        { headers: { Cookie: `session_id=${sessionId}` } },
      );

      return employeeData.result?.[0]?.id || null;
    } catch (error) {
      console.error('Error Odoo:', error.message);
      return null;
    }
  }
}
