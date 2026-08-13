import { Module } from '@nestjs/common';
import { DocumentsMgmtController } from './documents-mgmt.controller';
import { DocumentsMgmtService } from './documents-mgmt.service';

@Module({
  controllers: [DocumentsMgmtController],
  providers: [DocumentsMgmtService],
  exports: [DocumentsMgmtService],
})
export class DocumentsMgmtModule {}
