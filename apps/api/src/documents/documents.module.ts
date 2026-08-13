import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [FilesModule],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
