import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.types';
import { FilesService } from './files.service';

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: RequestWithUser,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatório');
    if (!ALLOWED.has(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo não permitido');
    }
    return this.files.store({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      uploadedBy: req.user.userId,
      workId: req.user.workId ?? undefined,
    });
  }

  @Get(':id')
  async download(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const opened = await this.files.openStream(id);
    if (!opened) throw new NotFoundException();
    if (
      opened.confidentiality === 'MEDICAL' &&
      !['TST', 'MANAGER', 'MASTER'].includes(req.user.role ?? '')
    ) {
      throw new ForbiddenException('Documento médico restrito');
    }
    res.setHeader('Content-Type', opened.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${opened.originalName.replace(/"/g, '')}"`,
    );
    opened.stream.pipe(res);
  }
}
