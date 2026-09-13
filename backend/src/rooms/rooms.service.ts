import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateRoomCode } from './room-code.util';
import { Player } from '@prisma/client';
import { RoomLobbyInfo, PlayerInfo } from '../socket/socket-events';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a room owned by `host`. Returns the lobby payload for the room.
   */
  async createRoom(host: Player): Promise<RoomLobbyInfo> {
    let code = generateRoomCode();
    // Retry if we hit a rare code collision.
    while (await this.prisma.room.findUnique({ where: { code } })) {
      code = generateRoomCode();
    }

    const room = await this.prisma.room.create({
      data: {
        code,
        hostId: host.id,
      },
    });

    await this.prisma.roomMember.create({
      data: { roomId: room.id, playerId: host.id },
    });

    return this.buildLobby(room.id);
  }

  /**
   * Idempotently seats `playerId` into `roomId` as a member (used to add a bot
   * opponent to a practice room without a human joining via a code).
   */
  async addMember(roomId: string, playerId: string): Promise<RoomLobbyInfo> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found.');
    }
    const existing = await this.prisma.roomMember.findUnique({
      where: { roomId_playerId: { roomId, playerId } },
    });
    const memberCount = await this.prisma.roomMember.count({ where: { roomId } });
    if (!existing && memberCount < 2) {
      await this.prisma.roomMember.create({
        data: { roomId, playerId },
      });
    }
    return this.buildLobby(roomId);
  }

  /**
   * Joins `player` to the room with the given `code`.
   */
  async joinRoom(code: string, player: Player): Promise<RoomLobbyInfo> {
    const room = await this.prisma.room.findUnique({ where: { code } });
    if (!room) {
      throw new NotFoundException(`No room found for code "${code}".`);
    }
    if (room.status !== 'LOBBY') {
      throw new BadRequestException('This room has already started a match.');
    }

    const memberCount = await this.prisma.roomMember.count({
      where: { roomId: room.id },
    });
    if (memberCount >= 2) {
      throw new BadRequestException('This room is full (max 2 players).');
    }

    const existing = await this.prisma.roomMember.findUnique({
      where: { roomId_playerId: { roomId: room.id, playerId: player.id } },
    });
    if (!existing) {
      await this.prisma.roomMember.create({
        data: { roomId: room.id, playerId: player.id },
      });
    }

    return this.buildLobby(room.id);
  }

  /**
   * Removes a player (by their socket id) from a room. If the room becomes
   * empty it is deleted.
   */
  async leaveRoom(
    roomId: string,
    socketId: string,
  ): Promise<RoomLobbyInfo | null> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return null;

    const player = await this.prisma.player.findFirst({ where: { socketId } });
    if (!player) return this.buildLobby(roomId);

    await this.prisma.roomMember.delete({
      where: { roomId_playerId: { roomId, playerId: player.id } },
    }).catch(() => undefined);

    const remaining = await this.prisma.roomMember.count({ where: { roomId } });
    if (remaining === 0) {
      await this.prisma.room.delete({ where: { id: roomId } }).catch(() => undefined);
      return null;
    }

    // If the host leaves, promote the first remaining member to host.
    if (room.hostId === player.id) {
      const next = await this.prisma.roomMember.findFirst({
        where: { roomId },
      });
      if (next) {
        await this.prisma.room.update({
          where: { id: roomId },
          data: { hostId: next.playerId },
        });
      }
    }

    return this.buildLobby(roomId);
  }

  /**
   * Resolves a lobby by its room code (used by the REST lookup endpoint).
   */
  async buildLobbyByCode(code: string): Promise<RoomLobbyInfo> {
    const room = await this.prisma.room.findUnique({ where: { code } });
    if (!room) {
      throw new NotFoundException(`No room found for code "${code}".`);
    }
    return this.buildLobby(room.id);
  }

  /**
   * Returns the raw room row (without lobby projection), or null if missing.
   */
  async getById(roomId: string) {
    return this.prisma.room.findUnique({ where: { id: roomId } });
  }

  /**
   * Builds the lobby payload (room + ordered player list with seat numbers).
   */
  private async buildLobby(roomId: string): Promise<RoomLobbyInfo> {    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found.');
    }

    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      include: { player: true },
      orderBy: { id: 'asc' },
    });

    const players: PlayerInfo[] = members.map((m, i) => ({
      id: m.playerId,
      name: m.player.name,
      seat: i + 1,
      isHost: m.playerId === room.hostId,
    }));

    return {
      roomId: room.id,
      code: room.code,
      status: room.status,
      players,
    };
  }
}
