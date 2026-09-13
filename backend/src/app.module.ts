import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { SocketModule } from './socket/socket.module';
import { RoomsModule } from './rooms/rooms.module';
import { PlayersModule } from './players/players.module';
import { MatchesModule } from './matches/matches.module';
import { AuthModule } from './auth/auth.module';
import { CardsModule } from './cards/cards.module';
import { BotModule } from './bots/bot.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RoomsModule,
    PlayersModule,
    MatchesModule,
    SocketModule,
    AuthModule,
    CardsModule,
    BotModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
