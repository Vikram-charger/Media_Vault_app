import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';

@Catch()
export class DriveAuthFilter implements ExceptionFilter {
  catch(e: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();

    // Normal Nest errors (401, 403, 400 ...) pass through unchanged
    if (e instanceof HttpException) {
      return res.status(e.getStatus()).json(e.getResponse());
    }

    // Dead or missing Drive refresh token
    const detail = JSON.stringify(e?.response?.data ?? e?.message ?? '');
    if (/invalid_grant|No refresh token/i.test(detail)) {
      return res.status(503).json({ code: 'DRIVE_AUTH_EXPIRED' });
    }

    // Unknown Drive file id
    const status = Number(e?.response?.status ?? e?.code);
    if (status === 404) {
      return res.status(404).json({ message: 'Not found' });
    }

    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
}