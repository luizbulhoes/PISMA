import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { DashboardsModule } from '../dashboards/dashboards.module';
import { DocumentsMgmtModule } from '../documents-mgmt/documents-mgmt.module';
import { EnvironmentModule } from '../environment/environment.module';
import { FieldModule } from '../field/field.module';
import { OccurrencesModule } from '../occurrences/occurrences.module';
import { PtModule } from '../pt/pt.module';
import { RiskModule } from '../risk/risk.module';
import { SyncModule } from '../sync/sync.module';
import { AliasesController } from './aliases.controller';

@Module({
  imports: [
    DashboardsModule,
    RiskModule,
    SyncModule,
    PtModule,
    FieldModule,
    EnvironmentModule,
    AssetsModule,
    DocumentsMgmtModule,
    OccurrencesModule,
  ],
  controllers: [AliasesController],
})
export class AliasesModule {}
