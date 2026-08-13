import { ACTIVITY_NATURES, defaultNaturesMap, roleLabel, type NatureFill } from '@pisma/domain';

export { ACTIVITY_NATURES, defaultNaturesMap, roleLabel };
export type { NatureFill };

export const PROFILE_FIELD_LABELS: Record<string, string> = {
  fullName: 'Nome completo',
  cpf: 'CPF',
  employeeNumber: 'Matrícula',
  jobFunction: 'Função',
  employer: 'Empresa',
  birthYear: 'Ano de nascimento',
};
