import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth/auth.controller.js';
import { DriveAdminController } from './drive/drive-admin.controller.js';
import { DriveService } from './drive/drive.service.js';
import { MediaController } from './media/media.controller.js';

@Module({
  imports: [JwtModule.register({ global: true, secret: process.env.JWT_SECRET })],
  controllers: [AuthController, DriveAdminController, MediaController],
  providers: [DriveService],
})
export class AppModule {}