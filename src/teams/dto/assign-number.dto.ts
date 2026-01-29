import { IsInt, Min, Max } from 'class-validator';

export class AssignNumberDto {
  @IsInt()
  @Min(1)
  @Max(99)
  number: number;
}
