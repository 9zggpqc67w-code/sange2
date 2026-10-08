import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApplicantDto {
  @ApiProperty({ example: 'Arjun Mehta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'arjun.mehta@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "Master's in Computer Science in Germany" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  goal?: string;

  @ApiPropertyOptional({ example: "DEMO Master's in Computer Science" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  programLabel?: string;
}

export class UpdateGoalDto {
  @ApiProperty({ example: "Master's in Computer Science in Germany" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  goal!: string;

  @ApiPropertyOptional({ example: "DEMO Master's in Computer Science" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  programLabel?: string;
}
