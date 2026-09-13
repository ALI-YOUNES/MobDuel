import { Controller, Get, Param } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CardType } from '@prisma/client';

@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get()
  findAll() {
    return this.cardsService.findAll();
  }

  @Get('type/:type')
  findByType(@Param('type') type: CardType) {
    return this.cardsService.findByType(type);
  }
}
