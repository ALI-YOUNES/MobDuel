import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlayerDto } from './dto/create-player.dto';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreatePlayerDto) {
    return this.prisma.player.upsert({
      where: { name: dto.name },
      update: {
        ...(dto.socketId ? { socketId: dto.socketId } : {}),
      },
      create: {
        name: dto.name,
        ...(dto.socketId ? { socketId: dto.socketId } : {}),
      },
    });
  }

  findOne(id: string) {
    return this.prisma.player.findUnique({ where: { id } });
  }

  findBySocket(socketId: string) {
    return this.prisma.player.findFirst({ where: { socketId } });
  }

  findAll() {
    return this.prisma.player.findMany({ orderBy: { createdAt: 'desc' } });
  }

  remove(id: string) {
    return this.prisma.player.delete({ where: { id } });
  }
}
