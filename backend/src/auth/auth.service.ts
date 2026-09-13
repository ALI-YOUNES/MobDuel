import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.player.findFirst({
      where: {
        OR: [
          { name: dto.name },
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        existing.name === dto.name
          ? 'That moniker is already taken.'
          : 'That email is already registered.',
      );
    }

    const hashed = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const player = await this.prisma.player.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
      },
    });

    const { password: _p, ...safe } = player;
    return { token: this.sign(player), player: safe };
  }

  async login(dto: LoginDto) {
    const player = await this.prisma.player.findUnique({
      where: { name: dto.name },
    });

    if (!player) {
      throw new UnauthorizedException('Incorrect moniker or password.');
    }

    const ok =
      player.password && (await bcrypt.compare(dto.password, player.password));
    if (!ok) {
      throw new UnauthorizedException('Incorrect moniker or password.');
    }

    const { password: _p, ...safe } = player;
    return { token: this.sign(player), player: safe };
  }

  async me(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            matchPlayers: true,
            wonMatches: true,
          },
        },
      },
    });
    if (!player) {
      throw new UnauthorizedException('Player no longer exists.');
    }
    const { password: _p, _count, ...safe } = player;
    const gamesPlayed = _count.matchPlayers;
    const gamesWon = _count.wonMatches;
    const winRate =
      gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

    return {
      ...safe,
      stats: { gamesPlayed, gamesWon, winRate },
    };
  }

  private sign(player: { id: string; name: string }) {
    return this.jwt.sign({ sub: player.id, name: player.name });
  }
}
