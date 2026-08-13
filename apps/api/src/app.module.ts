import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AliasesModule } from './aliases/aliases.module';
import { AssetsModule } from './assets/assets.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';
import { DocumentsMgmtModule } from './documents-mgmt/documents-mgmt.module';
import { EnvironmentModule } from './environment/environment.module';
import { FieldModule } from './field/field.module';
import { FilesModule } from './files/files.module';
import { HealthController } from './health/health.controller';
import { NoticesModule } from './notices/notices.module';
import { OccurrencesModule } from './occurrences/occurrences.module';
import { PeopleModule } from './people/people.module';
import { PtModule } from './pt/pt.module';
import { RiskModule } from './risk/risk.module';
import { SyncModule } from './sync/sync.module';
import { WorksModule } from './works/works.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    DatabaseModule,
    AuditModule,
    AuthModule,
    FilesModule,
    DocumentsModule,
    NoticesModule,
    WorksModule,
    PeopleModule,
    AssetsModule,
    DocumentsMgmtModule,
    RiskModule,
    PtModule,
    FieldModule,
    OccurrencesModule,
    EnvironmentModule,
    DashboardsModule,
    SyncModule,
    AliasesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
