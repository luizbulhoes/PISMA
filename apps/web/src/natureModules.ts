/** Checklists por natureza — FS 13-01 Permissão de Trabalho */

export type ChecklistAnswer = 'YES' | 'NO' | 'NA' | '';

export const GENERAL_PRECAUTIONS = [
  'As condições do ambiente são adequadas para execução do serviço?',
  'O ambiente está protegido contra vazamentos de óleos lubrificantes?',
  'A equipe envolvida conhece o sistema de emergência?',
  'Os trabalhadores da área estão cientes da atividade que será desenvolvida?',
  'As rotas de fuga estão desobstruídas?',
  'O local foi isolado e sinalizado para limitar / impedir o acesso de pessoas e veículos?',
  'Todos os equipamentos que serão usados foram preparados, inspecionados e estão prontos?',
  'As fontes de energias estão desligadas e bloqueadas?',
] as const;

export const NATURE_MODULES: Record<
  string,
  { code: string; label: string; items: string[] }
> = {
  QUENTE: {
    code: 'QUENTE',
    label: 'Trabalho a quente',
    items: [
      'Materiais ou gases combustíveis estão ausentes ou controlados no ambiente?',
      'Foi realizado o check-list dos equipamentos de trabalho a quente?',
      'Os cilindros de oxigênio e acetileno possuem válvula corta-chama?',
      'No local há pessoas habilitadas/capacitadas para utilizar os equipamentos de combate a incêndio?',
      'A máquina de solda está com os cabos de aterramento em perfeitas condições?',
      'O cenário de prevenção e combate a incêndio foi montado adequadamente (hidrantes/extintores/manta/biombo/limpeza)?',
      'O local foi avaliado pela segurança antes da atividade?',
      'O local está limpo, isolado e sinalizado para realizar a atividade?',
      'O perigo de condução de calor para outras áreas está controlado?',
      'Será verificada a área após 60 minutos do término do trabalho a quente?',
      'Os EPIs para trabalhos a quente estão adequados?',
    ],
  },
  ALTURA: {
    code: 'ALTURA',
    label: 'Trabalho em altura',
    items: [
      'As condições atmosféricas são favoráveis (ausência de chuvas, ventos fortes)?',
      'Foi fixado pranchões ou passarela em trabalhos no telhado?',
      'As escadas utilizadas estão em boas condições de segurança?',
      'Os pontos de ancoragem / linha de vida foram aprovados pela segurança do trabalho?',
      'Os andaimes, plataformas e escadas estão afastados da rede elétrica?',
      'Os executantes estão em boas condições físicas e psicológicas?',
      'Foi verificada estabilidade e travamento de andaimes/plataformas/escadas em piso resistente e plano?',
      'Os equipamentos de prevenção de queda estão em perfeitas condições (cinturão, trava-quedas, cabo-guia, ancoragem)?',
      'Os executantes estão capacitados e autorizados para realizar a atividade?',
      'Foi realizado check-list e aprovado para utilização da plataforma elevatória (quando aplicável)?',
      'Os andaimes foram inspecionados e aprovados pela segurança do trabalho?',
    ],
  },
  ICAMENTO: {
    code: 'ICAMENTO',
    label: 'Içamento de carga',
    items: [
      'Foi realizado isolamento e sinalização no perímetro do içamento da carga?',
      'Durante o içamento NÃO existe nenhum trabalho sobreposto?',
      'Foi realizado o plano de rigging e ART para içamento acima de 5 t (quando aplicável)?',
      'O operador possui habilidades e conhecimentos necessários para o içamento?',
      'O piso está adequado para patolamento do guindaste ou munck?',
      'O operador possui a carteirinha de identificação?',
      'Foi aplicado o check-list do equipamento a ser utilizado no içamento?',
      'Existe comunicação adequada entre o sinalizador e o operador?',
      'Foi instalada corda-guia ou dispositivo para auxiliar na movimentação?',
      'Foram inspecionados e aprovados todos os equipamentos e acessórios de içamento?',
    ],
  },
  ELETRICA: {
    code: 'ELETRICA',
    label: 'Eletricidade',
    items: [
      'As fontes de energia estão desligadas?',
      'Foi preenchido formulário específico para circuito energizado em alta tensão (quando aplicável)?',
      'As fontes de energia estão bloqueadas?',
      'Foi realizado teste de ausência de tensão?',
      'O equipamento está sinalizado com o cartão do responsável?',
      'Os trabalhos elétricos estão sendo realizados com equipe qualificada conforme procedimento?',
      'O local da atividade está seco e sem umidade?',
      'As condições do ambiente são adequadas para execução do serviço?',
      'Todos os equipamentos e estruturas ao redor estão aterrados?',
      'As portas da subestação permanecem abertas durante atividade no seu interior (quando aplicável)?',
      'Os eletricistas estão utilizando vestimentas/EPIs obrigatórios para atividades em partes elétricas?',
      'Materiais metálicos estão afastados de redes energizadas?',
      'O sistema está livre de energia residual (mecânica, química, térmica, hidráulica, pneumática, elétrica) com bloqueios aplicados?',
    ],
  },
  ESCAVACAO: {
    code: 'ESCAVACAO',
    label: 'Escavação',
    items: [
      'Foi verificada ausência de eletrodutos e/ou dutos subterrâneos?',
      'Existem duas ou mais pessoas envolvidas na atividade?',
      'O local de escavação possui escoramento/talude adequado (acima de 1,25 m)?',
      'O acesso às escavações garante que não haja quedas?',
      'A escavação permite saída e resgate rápido de pessoas?',
      'O trabalho a ser realizado foi autorizado pelo cliente/dono da área?',
      'A escada de acesso está adequada conforme norma vigente?',
      'Os riscos de torções, escorregões, batida contra e quedas estão controlados?',
    ],
  },
  ESPACO_CONFINADO: {
    code: 'ESPACO_CONFINADO',
    label: 'Espaço confinado',
    items: [
      'Foi realizada a análise do ambiente utilizando medidor de gases?',
      'Os equipamentos de resgate estão disponíveis em caso de emergência?',
      'Foi verificado o preenchimento da PET para trabalhos em espaço confinado?',
      'Foi utilizada ventilação externa, assegurando a qualidade do ar respirável?',
      'A temperatura do ambiente é adequada?',
      'O bombeiro ou brigadista está ciente da realização deste trabalho?',
      'Foram inspecionados e aprovados todos os equipamentos para a atividade no espaço confinado?',
      'A iluminação está adequada?',
    ],
  },
  FRIO: {
    code: 'FRIO',
    label: 'Trabalho a frio',
    items: [
      'As ferramentas estão em bom estado?',
      'Os equipamentos estão com as proteções?',
      'O risco de lesões nas mãos está controlado?',
      'Os equipamentos elétricos estão adequados?',
      'Os equipamentos possuem dispositivo de parada de emergência?',
      'O executante possui habilidade e conhecimento para realizar o serviço?',
    ],
  },
  ABERTURA_LINHA: {
    code: 'ABERTURA_LINHA',
    label: 'Abertura de linha/equipamento',
    items: [
      'A linha/equipamento está identificado e isolado?',
      'Foi realizado alívio de pressão / drenagem / purga conforme procedimento?',
      'Há contenção para produtos residuais?',
      'A equipe está ciente dos riscos de contato com produto/processo?',
      'EPIs específicos para o produto estão disponíveis e em uso?',
      'Há procedimento/APR específica para abertura de linha?',
    ],
  },
  OUTRO: {
    code: 'OUTRO',
    label: 'Outro crítico',
    items: [
      'A natureza crítica adicional foi descrita na atividade?',
      'Controles específicos da AR/APR para este risco estão implementados?',
      'A equipe foi orientada sobre os riscos adicionais?',
      'Há recursos de emergência adequados ao risco adicional?',
    ],
  },
};

export function emptyNatureAnswers(code: string): Record<string, ChecklistAnswer> {
  const mod = NATURE_MODULES[code];
  if (!mod) return {};
  return Object.fromEntries(mod.items.map((item) => [item, '' as ChecklistAnswer]));
}
