import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { CalendarSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCalendarSourceDto,
  ImportCalendarFileDto,
  UpdateCalendarSourceDto,
} from './dto/calendar-source.dto';
import {
  IcsFetchError,
  MAX_ICS_BYTES,
  fetchIcs,
  normalizeCalendarUrl,
} from './ics-fetcher';
import { ParsedIcsCalendar, ParsedIcsEvent, parseIcs } from './ics-parser';

const MAX_SOURCES_PER_USER = 20;
/** Ao abrir o calendário, links sincronizados há menos tempo que isso não são baixados de novo. */
const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const INSERT_CHUNK_SIZE = 1000;
const DEFAULT_COLORS = [
  '#7c5cff',
  '#0ea5e9',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#ec4899',
];

export interface UploadedIcsFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class CalendarSourcesService {
  private readonly logger = new Logger(CalendarSourcesService.name);

  constructor(private prisma: PrismaService) {}

  /** O link do Google/Outlook funciona como senha: nunca é devolvido inteiro ao front. */
  private present(source: CalendarSource & { _count?: { events: number } }) {
    return {
      id: source.id,
      name: source.name,
      type: source.type,
      urlHost: source.url ? new URL(source.url).hostname : null,
      color: source.color,
      lastSyncedAt: source.lastSyncedAt,
      lastError: source.lastError,
      createdAt: source.createdAt,
      eventCount: source._count?.events ?? 0,
    };
  }

  private async findOwned(userId: string, id: string) {
    const source = await this.prisma.calendarSource.findFirst({
      where: { id, userId },
    });
    if (!source) {
      throw new NotFoundException('Calendário não encontrado');
    }
    return source;
  }

  private async assertCanAddSource(userId: string) {
    const count = await this.prisma.calendarSource.count({ where: { userId } });
    if (count >= MAX_SOURCES_PER_USER) {
      throw new BadRequestException(
        `Limite de ${MAX_SOURCES_PER_USER} calendários externos atingido`,
      );
    }
    return DEFAULT_COLORS[count % DEFAULT_COLORS.length];
  }

  private async parseOrFail(content: string): Promise<ParsedIcsCalendar> {
    try {
      return await parseIcs(content);
    } catch (error) {
      this.logger.warn(`Falha ao interpretar .ics: ${String(error)}`);
      throw new BadRequestException(
        'Não foi possível ler o calendário. Confira se é um arquivo/link iCal (.ics).',
      );
    }
  }

  private async downloadOrFail(url: string) {
    try {
      return await fetchIcs(url);
    } catch (error) {
      if (error instanceof IcsFetchError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async replaceEvents(
    tx: Prisma.TransactionClient,
    userId: string,
    sourceId: string,
    events: ParsedIcsEvent[],
  ) {
    await tx.event.deleteMany({ where: { calendarSourceId: sourceId } });

    for (let i = 0; i < events.length; i += INSERT_CHUNK_SIZE) {
      await tx.event.createMany({
        data: events.slice(i, i + INSERT_CHUNK_SIZE).map((event) => ({
          ...event,
          userId,
          calendarSourceId: sourceId,
        })),
        skipDuplicates: true,
      });
    }
  }

  async findAll(userId: string) {
    const sources = await this.prisma.calendarSource.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { events: true } } },
    });
    return sources.map((source) => this.present(source));
  }

  async createFromUrl(userId: string, dto: CreateCalendarSourceDto) {
    let url: string;
    try {
      url = normalizeCalendarUrl(dto.url).toString();
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const defaultColor = await this.assertCanAddSource(userId);

    const duplicate = await this.prisma.calendarSource.findFirst({
      where: { userId, url },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Este calendário já foi adicionado');
    }

    const parsed = await this.parseOrFail(await this.downloadOrFail(url));

    const source = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.calendarSource.create({
          data: {
            userId,
            type: 'ICS_URL',
            url,
            name:
              dto.name?.trim() || parsed.calendarName || new URL(url).hostname,
            color: dto.color ?? defaultColor,
            lastSyncedAt: new Date(),
          },
        });
        await this.replaceEvents(tx, userId, created.id, parsed.events);
        return created;
      },
      { timeout: 30_000 },
    );

    return {
      source: this.present({
        ...source,
        _count: { events: parsed.events.length },
      }),
      imported: parsed.events.length,
      truncated: parsed.truncated,
    };
  }

  async importFile(
    userId: string,
    file: UploadedIcsFile | undefined,
    dto: ImportCalendarFileDto,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo .ics');
    }
    if (file.size > MAX_ICS_BYTES) {
      throw new BadRequestException('O arquivo é grande demais (máx. 10 MB)');
    }

    const defaultColor = await this.assertCanAddSource(userId);
    const parsed = await this.parseOrFail(file.buffer.toString('utf8'));
    const fileName = file.originalname.replace(/\.ics$/i, '').trim();

    const source = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.calendarSource.create({
          data: {
            userId,
            type: 'ICS_FILE',
            name:
              dto.name?.trim() ||
              parsed.calendarName ||
              fileName ||
              'Calendário importado',
            color: dto.color ?? defaultColor,
            lastSyncedAt: new Date(),
          },
        });
        await this.replaceEvents(tx, userId, created.id, parsed.events);
        return created;
      },
      { timeout: 30_000 },
    );

    return {
      source: this.present({
        ...source,
        _count: { events: parsed.events.length },
      }),
      imported: parsed.events.length,
      truncated: parsed.truncated,
    };
  }

  private async syncSource(source: CalendarSource) {
    if (source.type !== 'ICS_URL' || !source.url) {
      throw new BadRequestException(
        'Calendários importados por arquivo não podem ser sincronizados. Importe o arquivo novamente.',
      );
    }

    try {
      const parsed = await this.parseOrFail(
        await this.downloadOrFail(source.url),
      );
      await this.prisma.$transaction(
        async (tx) => {
          await this.replaceEvents(tx, source.userId, source.id, parsed.events);
          await tx.calendarSource.update({
            where: { id: source.id },
            data: { lastSyncedAt: new Date(), lastError: null },
          });
        },
        { timeout: 30_000 },
      );
      return { imported: parsed.events.length, truncated: parsed.truncated };
    } catch (error) {
      const message =
        error instanceof BadRequestException
          ? error.message
          : 'Erro inesperado ao sincronizar';
      await this.prisma.calendarSource.update({
        where: { id: source.id },
        data: { lastError: message },
      });
      throw error;
    }
  }

  async sync(userId: string, id: string) {
    const source = await this.findOwned(userId, id);
    const result = await this.syncSource(source);
    const updated = await this.prisma.calendarSource.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { events: true } } },
    });
    return { source: this.present(updated), ...result };
  }

  /**
   * Chamado ao abrir o calendário: atualiza os links que estão desatualizados.
   * Substitui um cron, que não roda de forma confiável com o servidor dormindo (Render free).
   */
  async syncStale(userId: string) {
    const staleBefore = new Date(Date.now() - AUTO_SYNC_INTERVAL_MS);
    const sources = await this.prisma.calendarSource.findMany({
      where: {
        userId,
        type: 'ICS_URL',
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: staleBefore } }],
      },
    });

    let synced = 0;
    let failed = 0;
    for (const source of sources) {
      try {
        await this.syncSource(source);
        synced++;
      } catch {
        failed++;
      }
    }
    return { synced, failed };
  }

  async update(userId: string, id: string, dto: UpdateCalendarSourceDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.calendarSource.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        color: dto.color,
      },
      include: { _count: { select: { events: true } } },
    });
    return this.present(updated);
  }

  async remove(userId: string, id: string) {
    const deleted = await this.prisma.calendarSource.deleteMany({
      where: { id, userId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Calendário não encontrado');
    }
    return { deleted: true };
  }
}
