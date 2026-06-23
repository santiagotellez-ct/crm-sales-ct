export interface ChecklistItem {
  key: string;
  label: string;
  type?: "text" | "select";
  options?: string[];
  allowOtherText?: boolean;
}
export interface ChecklistGroup {
  stageKey: string;
  title: string;
  stageOrder: number;
  items: ChecklistItem[];
}

// stageOrder matches deal_stages.order
export const DEAL_CHECKLISTS: ChecklistGroup[] = [
  {
    stageKey: "discovery",
    stageOrder: 1,
    title: "Discovery realizado",
    items: [
      {
        key: "categoria",
        label: "Categoría",
        type: "select",
        options: ["Fintech", "Banca", "SaaS", "Servicios & Consultoría IT", "Otras"],
        allowOtherText: true,
      },
      { key: "icp_empresa", label: "ICP de la empresa" },
      { key: "dolor_identificado", label: "Dolor identificado" },
      { key: "decisor_identificado", label: "Decisor identificado" },
      { key: "budget_range", label: "Budget range identificado" },
    ],
  },
  {
    stageKey: "presentada",
    stageOrder: 3,
    title: "Propuesta Presentada",
    items: [
      { key: "propuesta_enviada", label: "Propuesta enviada/presentada" },
      { key: "decisor_involucrado", label: "Decisor involucrado" },
    ],
  },
  {
    stageKey: "revisada",
    stageOrder: 4,
    title: "Propuesta revisada",
    items: [
      { key: "feedback_recibido", label: "Feedback recibido" },
      { key: "objeciones_identificadas", label: "Objeciones identificadas" },
    ],
  },
  {
    stageKey: "negociacion",
    stageOrder: 5,
    title: "Propuesta en negociación",
    items: [
      { key: "objeciones_solucionadas", label: "Objeciones solucionadas" },
    ],
  },
  {
    stageKey: "commited",
    stageOrder: 6,
    title: "Committed",
    items: [
      { key: "confirmacion_entrada", label: "Confirmación de entrada" },
      { key: "documentacion_admin", label: "Documentación administrativa enviada" },
    ],
  },
  {
    stageKey: "ganado",
    stageOrder: 7,
    title: "Won",
    items: [
      { key: "contrato_firmado", label: "Contrato firmado" },
      { key: "kickoff_agendado", label: "Kickoff agendado" },
    ],
  },
];

export function itemId(stageKey: string, itemKey: string) {
  return `${stageKey}.${itemKey}`;
}