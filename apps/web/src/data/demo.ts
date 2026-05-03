import type { AutomationFlow, DashboardSummary, SmartFolder, VaultDocument } from "@usa-latino-prime/shared";

export const dashboardSummary: DashboardSummary = {
  userName: "Marisol",
  tier: "base",
  status: "yellow",
  totals: {
    documentsExpiring: 4,
    pendingTasks: 2,
    activeCases: 1,
    newMessages: 0
  },
  alerts: [
    {
      id: "court-1",
      kind: "court_hearing",
      title: "Audiencia en corte",
      detail: "EOIR: 19 de mayo de 2026. Confirma sala, hora y direccion.",
      dueAt: "2026-05-19T09:00:00-06:00",
      dueLabel: "17 dias",
      severity: "yellow",
      source: "EOIR"
    },
    {
      id: "ead-1",
      kind: "ead_expiration",
      title: "Expira tu EAD",
      detail: "I-765 (C09). Prepara renovacion antes del 30 de junio.",
      dueAt: "2026-06-30T17:00:00-06:00",
      dueLabel: "59 dias",
      severity: "yellow",
      source: "USCIS"
    },
    {
      id: "address-1",
      kind: "address_change",
      title: "Cambio de direccion pendiente",
      detail: "AR-11 listo para firma. EOIR-33 requiere revision si tienes corte.",
      dueAt: "2026-05-05T17:00:00-06:00",
      dueLabel: "3 dias",
      severity: "red",
      source: "USCIS"
    }
  ]
};

export const smartFolders: SmartFolder[] = [
  { id: "uscis", label: "USCIS", agency: "USCIS", count: 12, color: "#1267b1" },
  { id: "eoir", label: "EOIR (Corte)", agency: "EOIR", count: 9, color: "#258f3d" },
  { id: "cbp", label: "CBP / I-94", agency: "CBP", count: 6, color: "#d58a23" },
  { id: "id", label: "Identificacion", agency: "OTHER", count: 4, color: "#6750a4" },
  { id: "work", label: "Laborales", agency: "OTHER", count: 5, color: "#ce2f3b" },
  { id: "finance", label: "Financieros", agency: "OTHER", count: 3, color: "#178f8f" }
];

export const recentDocuments: VaultDocument[] = [
  {
    id: "doc-1",
    title: "I-797C Notice of Action",
    agency: "USCIS",
    docType: "I797C",
    capturedAt: "2026-04-27",
    offlineAvailable: true,
    status: "classified"
  },
  {
    id: "doc-2",
    title: "EAD I-766 Card",
    agency: "USCIS",
    docType: "EAD_CARD",
    capturedAt: "2026-04-12",
    offlineAvailable: true,
    status: "classified"
  },
  {
    id: "doc-3",
    title: "Notice of Hearing EOIR-31",
    agency: "EOIR",
    docType: "NOTICE_OF_HEARING",
    capturedAt: "2026-03-31",
    offlineAvailable: true,
    status: "needs_review"
  }
];

export const automationFlows: AutomationFlow[] = [
  {
    id: "auto-aaf",
    filingType: "ANNUAL_ASYLUM_FEE",
    title: "Pago Tarifa Anual de Asilo",
    description: "Prepara alerta, datos y comprobante para pago oficial USCIS.",
    status: "not_started",
    progress: 0,
    legalReviewRequired: false
  },
  {
    id: "auto-1",
    filingType: "AR11",
    title: "AR-11 Cambio de direccion",
    description: "Actualiza tu direccion con USCIS.",
    status: "ready_to_sign",
    progress: 82,
    legalReviewRequired: false
  },
  {
    id: "auto-2",
    filingType: "EOIR33",
    title: "EOIR-33 Cambio de direccion",
    description: "Notifica tu direccion a la corte.",
    status: "not_started",
    progress: 0,
    legalReviewRequired: true
  },
  {
    id: "auto-3",
    filingType: "CHANGE_OF_VENUE",
    title: "Mocion para cambio de sede",
    description: "Prepara un borrador para mover tu audiencia.",
    status: "draft",
    progress: 35,
    legalReviewRequired: true
  },
  {
    id: "auto-4",
    filingType: "I765_RENEWAL",
    title: "I-765 Renovacion C09",
    description: "Genera paquete de renovacion de permiso de trabajo.",
    status: "draft",
    progress: 40,
    legalReviewRequired: true
  }
];

export const resourceRows = [
  { id: "legal", label: "Asistencia legal", detail: "Servicios legales de inmigracion", icon: "legal" },
  { id: "community", label: "Organizaciones comunitarias", detail: "Apoyo y orientacion en tu area", icon: "community" },
  { id: "clinic", label: "Clinicas gratuitas", detail: "Eventos y clinicas cerca de ti", icon: "clinic" },
  { id: "translator", label: "Traductores certificados", detail: "Ayuda en tu idioma", icon: "translator" }
];
