import { Controller, Get, Param } from '@nestjs/common';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get(':code')
  async findByCode(@Param('code') code: string) {
    const lobby = await this.roomsService.buildLobbyByCode(code.toUpperCase());
    return lobby;
  }
}
