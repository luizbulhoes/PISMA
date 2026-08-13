import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { PtController } from './pt.controller';
import { PtService } from './pt.service';

@Module({
  imports: [AssetsModule],
  controllers: [PtController],
  providers: [PtService],
  exports: [PtService],
})
export class PtModule {}
