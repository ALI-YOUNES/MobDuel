import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MatchesService } from './matches.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get('room/:roomId')
  async current(@Param('roomId') roomId: string) {
    const match = await this.matchesService.findByRoom(roomId);
    return match;
  }

  @Post('room/:roomId/end')
  async end(@Param('roomId') roomId: string, @Body() body: { winnerId?: string }) {
    return this.matchesService.endMatch(roomId, body.winnerId);
  }
}
