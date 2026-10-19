import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { DriveService } from './drive.service.js';

@UseGuards(AuthGuard)
@Controller('api/admin/drive')
export class DriveAdminController {
  constructor(private drive: DriveService) {}

  @Get('connect')
  connect(@Res() res: Response) {
    res.redirect(this.drive.authUrl());
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    await this.drive.saveFromCode(code);
    // Backend-only for now: land on the status JSON.
    // Once the React app exists, redirect to process.env.FRONTEND_ORIGIN instead.
    res.redirect('/api/admin/drive/status');
  }

  @Get('status')
  status() {
    return this.drive.status();
  }
}