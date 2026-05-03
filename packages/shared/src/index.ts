import { z } from "zod";

export const agencySchema = z.enum(["USCIS", "EOIR", "CBP", "DMV", "OTHER"]);
export const statusSeveritySchema = z.enum(["green", "yellow", "red"]);
export const subscriptionTierSchema = z.enum(["free", "base", "premium", "expert"]);

export const documentTypeSchema = z.enum([
  "I94",
  "I797C",
  "I765",
  "EAD_CARD",
  "EOIR33",
  "NOTICE_OF_HEARING",
  "DRIVER_LICENSE",
  "PASSPORT",
  "OTHER"
]);

export const filingTypeSchema = z.enum([
  "ANNUAL_ASYLUM_FEE",
  "AR11",
  "EOIR33",
  "CHANGE_OF_VENUE",
  "I765_RENEWAL"
]);

export const premiumServiceTypeSchema = z.enum([
  "ANNUALITY_PAYMENT",
  "EXPERT_REVIEW",
  "SPECIAL_CASE_TRACKING"
]);

export const alertKindSchema = z.enum([
  "court_hearing",
  "ead_expiration",
  "biometrics",
  "filing_deadline",
  "address_change",
  "case_status_change"
]);

export const criticalAlertSchema = z.object({
  id: z.string(),
  kind: alertKindSchema,
  title: z.string(),
  detail: z.string(),
  dueAt: z.string(),
  dueLabel: z.string(),
  severity: statusSeveritySchema,
  source: agencySchema.optional()
});

export const dashboardSummarySchema = z.object({
  userName: z.string(),
  tier: subscriptionTierSchema,
  status: statusSeveritySchema,
  totals: z.object({
    documentsExpiring: z.number().int().nonnegative(),
    pendingTasks: z.number().int().nonnegative(),
    activeCases: z.number().int().nonnegative(),
    newMessages: z.number().int().nonnegative()
  }),
  alerts: z.array(criticalAlertSchema)
});

export const smartFolderSchema = z.object({
  id: z.string(),
  label: z.string(),
  agency: agencySchema.optional(),
  count: z.number().int().nonnegative(),
  color: z.string()
});

export const vaultDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  agency: agencySchema,
  docType: documentTypeSchema,
  capturedAt: z.string(),
  offlineAvailable: z.boolean(),
  status: z.enum(["classified", "needs_review", "expired", "processing"])
});

export const automationFlowSchema = z.object({
  id: z.string(),
  filingType: filingTypeSchema,
  title: z.string(),
  description: z.string(),
  status: z.enum(["not_started", "draft", "needs_review", "ready_to_sign", "exported"]),
  progress: z.number().min(0).max(100),
  legalReviewRequired: z.boolean()
});

export const premiumServiceSchema = z.object({
  id: z.string(),
  serviceType: premiumServiceTypeSchema,
  title: z.string(),
  description: z.string(),
  priceMode: z.enum(["free", "one_time", "annual", "manual_quote"]),
  enabled: z.boolean()
});

export type Agency = z.infer<typeof agencySchema>;
export type StatusSeverity = z.infer<typeof statusSeveritySchema>;
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type FilingType = z.infer<typeof filingTypeSchema>;
export type PremiumServiceType = z.infer<typeof premiumServiceTypeSchema>;
export type AlertKind = z.infer<typeof alertKindSchema>;
export type CriticalAlert = z.infer<typeof criticalAlertSchema>;
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
export type SmartFolder = z.infer<typeof smartFolderSchema>;
export type VaultDocument = z.infer<typeof vaultDocumentSchema>;
export type AutomationFlow = z.infer<typeof automationFlowSchema>;
export type PremiumService = z.infer<typeof premiumServiceSchema>;
