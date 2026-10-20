import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateEventDto } from './create-event.dto';

/** Todos os campos são opcionais; noteId: null desvincula a nota. */
export class UpdateEventDto extends PartialType(
  OmitType(CreateEventDto, ['taskId'] as const),
) {}
