import { BadRequestException, Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Request() req, @Query('q') q?: string) {
    const query = q?.trim() ?? '';

    if (query.length === 0) {
      return [];
    }

    if (query.length < 2) {
      throw new BadRequestException('A busca precisa ter ao menos 2 caracteres');
    }

    return this.searchService.searchAll(req.user.userId, query);
  }
}
