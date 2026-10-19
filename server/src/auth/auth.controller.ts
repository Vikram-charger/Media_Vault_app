import { Body, Controller, Get, Post, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { AuthGuard } from './auth.guard.js';

@Controller('api/auth')
export class AuthController {
  constructor(private jwt: JwtService) {}

  @Post('login')
  async login(
    @Body() b: { username?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const userOk = b?.username === process.env.APP_USER;
    const passOk = await bcrypt.compare(b?.password ?? '', process.env.APP_PASS_HASH ?? '');
    if (!userOk || !passOk) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwt.sign({ sub: b.username }, { expiresIn: '7d' });
    const crossSite = process.env.CROSS_SITE === 'true';
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: crossSite ? 'none' : 'lax',
      secure: crossSite || process.env.NODE_ENV === 'production',
      maxAge: 7 * 864e5,
    });
    return { ok: true };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token');
    return { ok: true };
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me() {
    return { ok: true };
  }
}