import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsString, ValidateNested } from 'class-validator';

export class UpdateActivityEditorsDto {
  /** list of userIds who can edit tactics for this activity */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  editorUserIds: string[];
}
