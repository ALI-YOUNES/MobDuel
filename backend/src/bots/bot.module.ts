import { Global, Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { MatchesModule } from '../matches/matches.module';
import { RoomsModule } from '../rooms/rooms.module';
import { PlayersModule } from '../players/players.module';

@Global()
@Module({
  imports: [MatchesModule, RoomsModule, PlayersModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
