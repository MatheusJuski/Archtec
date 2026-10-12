import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { authThrottle } from '../throttle.config';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Throttle(authThrottle)
  @Post('register')
  register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Throttle(authThrottle)
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.usersService.login(loginDto);
  }

  @Throttle(authThrottle)
  @Post('google')
  googleAuth(@Body() dto: GoogleAuthDto) {
    return this.usersService.googleAuth(dto);
  }

  // Rota Protegida: Só acessa quem tem o Token
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: AuthenticatedRequest) {
    // O Passport anexa o que retornamos na Strategy em req.user
    return req.user;
  }
}
