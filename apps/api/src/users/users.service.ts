import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt'; 
import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'crypto';

@Injectable()
export class UsersService {
  private readonly googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    private prisma: PrismaService, 
    private jwtService: JwtService
  ) {}

  private buildAuthResponse(user: { id: string; email: string; name: string | null }) {
    const payload = { email: user.email, sub: user.id };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async create(createUserDto: CreateUserDto) {
    const { email, password, name } = createUserDto;

    const userExists = await this.prisma.user.findUnique({ where: { email } });
    if (userExists) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: { email, name, password: hashedPassword },
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.buildAuthResponse(user);
  }

  async googleAuth(dto: GoogleAuthDto) {
    let ticket;

    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch {
      throw new UnauthorizedException('Token Google inválido');
    }

    const payload = ticket.getPayload();
    if (!payload?.email || payload.email_verified === false) {
      throw new UnauthorizedException('Conta Google sem e-mail válido');
    }

    const email = payload.email.toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      const fallbackPassword = await bcrypt.hash(randomUUID(), 10);
      user = await this.prisma.user.create({
        data: {
          email,
          name: payload.name ?? null,
          password: fallbackPassword,
        },
      });
    }

    return this.buildAuthResponse(user);
  }
}