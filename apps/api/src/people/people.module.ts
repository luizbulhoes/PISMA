import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { FilesModule } from '../files/files.module';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';

@Module({
  imports: [FilesModule, DocumentsModule],
  controllers: [PeopleController],
  providers: [PeopleService],
  exports: [PeopleService],
})
export class PeopleModule {}
