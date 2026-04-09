import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prismaMock: {
    user: {
      findUnique: jest.Mock;
    };
  };
  let jwtServiceMock: {
    sign: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
      },
    };

    jwtServiceMock = {
      sign: jest.fn(),
    };

    service = new UsersService(prismaMock as unknown as PrismaService, jwtServiceMock as unknown as JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve autenticar com sucesso e retornar token', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'ana@arq.com',
      name: 'Ana',
      password: 'hash-salvo',
    });

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwtServiceMock.sign.mockReturnValue('jwt-token-valido');

    const result = await service.login({
      email: 'ana@arq.com',
      password: 'senha-correta',
    });

    expect(bcrypt.compare).toHaveBeenCalledWith('senha-correta', 'hash-salvo');
    expect(jwtServiceMock.sign).toHaveBeenCalledWith({
      email: 'ana@arq.com',
      sub: 'user-1',
    });
    expect(result).toEqual({
      access_token: 'jwt-token-valido',
      user: {
        id: 'user-1',
        email: 'ana@arq.com',
        name: 'Ana',
      },
    });
  });

  it('deve falhar quando usuário não existe', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const compareSpy = bcrypt.compare as jest.Mock;

    await expect(
      service.login({
        email: 'inexistente@arq.com',
        password: 'qualquer',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(compareSpy).not.toHaveBeenCalled();
    expect(jwtServiceMock.sign).not.toHaveBeenCalled();
  });

  it('deve falhar quando senha está incorreta', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'bia@arq.com',
      name: 'Bia',
      password: 'hash-salvo',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({
        email: 'bia@arq.com',
        password: 'senha-errada',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(jwtServiceMock.sign).not.toHaveBeenCalled();
  });
});
