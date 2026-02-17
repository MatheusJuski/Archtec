import { Injectable } from '@nestjs/common';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createNoteDto: CreateNoteDto) {
    const { title, content, tags } = createNoteDto;

    return this.prisma.note.create({
      data: {
        title,
        content,
        userId, 
        tags: {
          connectOrCreate: tags?.map((tag) => ({
            where: { name: tag },
            create: { name: tag },
          })),
        },
      },
      include: {
        tags: true, 
      },
    });
  }

  async update(id: string, userId: string, updateNoteDto: UpdateNoteDto) {
    // 1. Verifica se a nota existe e pertence ao usuário
    const note = await this.prisma.note.findFirst({
      where: { id, userId },
    });

    if (!note) {
      throw new NotFoundException('Nota não encontrada ou acesso negado');
    }

    const { title, content, tags } = updateNoteDto;

    // 2. Atualiza
    return this.prisma.note.update({
      where: { id },
      data: {
        title,
        content,
        tags: tags ? {
          set: [], 
          connectOrCreate: tags.map((tag) => ({
            where: { name: tag },
            create: { name: tag },
          })),
        } : undefined,
      },
      include: { tags: true },
    });
  }

  findAll(userId: string) {
    return this.prisma.note.findMany({
      where: { userId },
      include: { tags: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} note`;
  }


  async remove(id: string, userId: string) {
      // 1. Verifica se existe/pertence
      const note = await this.prisma.note.findFirst({
        where: { id, userId },
      });

      if (!note) {
        throw new NotFoundException('Nota não encontrada ou acesso negado');
      }

      // 2. Deleta
      return this.prisma.note.delete({
        where: { id },
      });
    }
}