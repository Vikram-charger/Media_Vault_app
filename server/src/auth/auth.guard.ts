import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    try {
      req.user = this.jwt.verify(req.cookies?.token);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}