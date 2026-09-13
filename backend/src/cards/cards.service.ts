import { Injectable } from '@nestjs/common';
import { CardType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.card.findMany({ orderBy: { id: 'asc' } });
  }

  findByType(type: CardType) {
    return this.prisma.card.findMany({
      where: { type },
      orderBy: { id: 'asc' },
    });
  }
}
