import { IsNotEmpty, IsString, Length } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Room code must be exactly 6 characters.' })
  code: string;
}
