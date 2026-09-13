import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { RoomsModule } from '../rooms/rooms.module';
import { MatchesModule } from '../matches/matches.module';
import { PlayersModule } from '../players/players.module';

@Module({
  imports: [RoomsModule, MatchesModule, PlayersModule],
  providers: [SocketGateway],
})
export class SocketModule {}
