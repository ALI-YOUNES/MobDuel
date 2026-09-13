import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9 _-]+$/, {
    message: 'Moniker may only contain letters, numbers, spaces, _ and -',
  })
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  password: string;
}
