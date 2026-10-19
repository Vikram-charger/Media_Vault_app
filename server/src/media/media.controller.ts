import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { tmpdir } from 'os';
import { unlink } from 'fs/promises';
import type { Request, Response } from 'express';
import type { Readable } from 'stream';
import { AuthGuard } from '../auth/auth.guard.js';
import { DriveService } from '../drive/drive.service.js';

const ALLOWED = /^(image|video)\//;

@UseGuards(AuthGuard)
@Controller('api/media')
export class MediaController {
  constructor(private drive: DriveService) {}

  @Get()
  list() {
    return this.drive.list();
  }

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 50, {
      storage: diskStorage({ destination: tmpdir() }),
      limits: { fileSize: 2 * 1024 ** 3 }, // 2 GB per file
      fileFilter: (_req, file, cb) => cb(null, ALLOWED.test(file.mimetype)),
    }),
  )
  async upload(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) {
      throw new BadRequestException('No valid image or video files');
    }
    const results: any[] = [];
    for (const f of files) {
      try {
        results.push(await this.drive.upload(f.originalname, f.mimetype, f.path));
      } finally {
        await unlink(f.path).catch(() => {}); // always clean the temp file
      }
    }
    return results;
  }

  @Get(':id')
  async file(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const r = await this.drive.stream(id, req.headers.range);

    // headers may be a plain object or a Headers instance depending on googleapis version
    const h: any = r.headers;
    const get = (k: string) => (typeof h?.get === 'function' ? h.get(k) : h?.[k]);

    res.status(r.status);
    for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const v = get(k);
      if (v) res.setHeader(k, String(v));
    }
    res.setHeader('Cache-Control', 'private, max-age=86400');

    const stream = r.data as unknown as Readable;
    req.on('close', () => stream.destroy()); // stop downloading if the browser leaves
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.drive.delete(id);
    return { ok: true };
  }
}