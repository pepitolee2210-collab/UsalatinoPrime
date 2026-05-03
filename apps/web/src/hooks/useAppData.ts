import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type {
  Agency,
  AlertKind,
  AutomationFlow,
  CriticalAlert,
  DashboardSummary,
  FilingType,
  PremiumService,
  PremiumServiceType,
  SmartFolder,
  StatusSeverity,
  VaultDocument
} from "@usa-latino-prime/shared";
import { automationFlows, dashboardSummary, recentDocuments, smartFolders } from "../data/demo";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type CriticalDateRow = Database["public"]["Tables"]["critical_dates"]["Row"];
type DocumentRow = Database["public"]["Tables"]["user_documents"]["Row"];
type CaseRow = Database["public"]["Tables"]["immigration_cases"]["Row"];
type FormDefinitionRow = Database["public"]["Tables"]["form_definitions"]["Row"];
type PremiumServiceRow = Database["public"]["Tables"]["premium_services"]["Row"];
type DmvQuestionRow = Database["public"]["Tables"]["dmv_questions"]["Row"];

type DataMode = "preview" | "auth_required" | "live";
type AuthIntent = "signin" | "signup";

export type UserProfile = Pick<
  ProfileRow,
  | "full_name"
  | "state_code"
  | "onboarding_completed_at"
  | "legal_disclaimer_ack_at"
  | "privacy_consented_at"
>;

export type CompleteOnboardingInput = {
  fullName: string;
  stateCode: string;
};

export type UploadDocumentInput = {
  file: File;
  title?: string;
  ocrText?: string;
};

export type AddCriticalDateInput = {
  details?: string;
  dueDate: string;
  kind: AlertKind;
  severity: StatusSeverity;
  source: Agency;
  title: string;
};

export type AddCaseInput = {
  agency: Extract<Agency, "USCIS">;
  formCode?: string;
  receiptNumber: string;
};

export type CaseSummary = {
  agency: Agency;
  formCode: string | null;
  id: string;
  lastCheckedAt: string | null;
  receiptNumber: string | null;
  status: string;
  statusSource: string;
};

export type DmvPracticeQuestion = {
  answerKey: string;
  choices: Array<{
    key: string;
    label: string;
  }>;
  explanation: string | null;
  id: string;
  prompt: string;
  topic: string | null;
};

export type FormQuestion = {
  data_type: string;
  display_order: number;
  help_text_es: string | null;
  label_en: string | null;
  label_es: string;
  question_key: string;
  required: boolean;
  validation_rule: {
    options?: Array<{
      label_es: string;
      value: string;
    }>;
  };
};

export type ActiveWorkflow = {
  formCode: string;
  questions: FormQuestion[];
  sessionId: string;
  status: string;
};

type AppData = {
  activeWorkflow: ActiveWorkflow | null;
  mode: DataMode;
  loading: boolean;
  authBusy: boolean;
  workflowBusy: boolean;
  error: string | null;
  authMessage: string | null;
  generatedPacketUrl: string | null;
  packetMessage: string | null;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  needsOnboarding: boolean;
  dashboard: DashboardSummary;
  folders: SmartFolder[];
  documents: VaultDocument[];
  automations: AutomationFlow[];
  cases: CaseSummary[];
  dmvQuestions: DmvPracticeQuestion[];
  premiumServices: PremiumService[];
  addCase: (input: AddCaseInput) => Promise<void>;
  addCriticalDate: (input: AddCriticalDateInput) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  cacheDocumentOffline: (documentId: string) => Promise<void>;
  completeOnboarding: (input: CompleteOnboardingInput) => Promise<void>;
  generatePdfPacket: (sessionId: string) => Promise<void>;
  openDocument: (documentId: string) => Promise<string | null>;
  refreshCaseStatus: (caseId: string) => Promise<void>;
  saveFormAnswer: (sessionId: string, questionKey: string, answer: unknown) => Promise<void>;
  signInWithEmail: (email: string, fullName?: string, intent?: AuthIntent) => Promise<void>;
  signOut: () => Promise<void>;
  requestPremiumService: (serviceType: PremiumServiceType) => Promise<void>;
  startFormSession: (formCode: string) => Promise<void>;
  uploadDocument: (input: UploadDocumentInput) => Promise<void>;
};

const agencyColors: Record<Agency, string> = {
  USCIS: "#1267b1",
  EOIR: "#258f3d",
  CBP: "#d58a23",
  DMV: "#178f8f",
  OTHER: "#6750a4"
};

const alertKinds = new Set<AlertKind>([
  "court_hearing",
  "ead_expiration",
  "biometrics",
  "filing_deadline",
  "address_change",
  "case_status_change"
]);

const documentTypes = new Set<VaultDocument["docType"]>([
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

function getDisplayName(profile: ProfileRow | null, user: User | null): string {
  if (profile?.full_name) return profile.full_name.split(" ")[0] ?? profile.full_name;
  if (user?.email) return user.email.split("@")[0] ?? user.email;
  return dashboardSummary.userName;
}

function normalizeAgency(value: string | null | undefined): Agency {
  if (value === "USCIS" || value === "EOIR" || value === "CBP" || value === "DMV") return value;
  return "OTHER";
}

function normalizeAlertKind(value: string): AlertKind {
  return alertKinds.has(value as AlertKind) ? (value as AlertKind) : "filing_deadline";
}

function normalizeDocumentType(value: string): VaultDocument["docType"] {
  return documentTypes.has(value as VaultDocument["docType"]) ? (value as VaultDocument["docType"]) : "OTHER";
}

function normalizeDocumentStatus(row: DocumentRow): VaultDocument["status"] {
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return "expired";
  if (row.status === "classified") return "classified";
  if (row.status === "processing" || row.status === "uploaded") return "processing";
  return "needs_review";
}

function dueLabel(dueAt: string): string {
  const diff = new Date(dueAt).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return "Vencido";
  if (days === 0) return "Hoy";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}

function mapCriticalDate(row: CriticalDateRow): CriticalAlert {
  return {
    id: row.id,
    kind: normalizeAlertKind(row.kind),
    title: row.title,
    detail: row.details || row.source,
    dueAt: row.due_at,
    dueLabel: dueLabel(row.due_at),
    severity: row.severity,
    source: normalizeAgency(row.source)
  };
}

function mapDocument(row: DocumentRow): VaultDocument {
  return {
    id: row.id,
    title: row.title,
    agency: normalizeAgency(row.agency),
    docType: normalizeDocumentType(row.doc_type),
    capturedAt: row.created_at,
    offlineAvailable: row.offline_allowed,
    status: normalizeDocumentStatus(row)
  };
}

function mapCase(row: CaseRow): CaseSummary {
  return {
    agency: normalizeAgency(row.agency),
    formCode: row.form_code,
    id: row.id,
    lastCheckedAt: row.last_checked_at,
    receiptNumber: row.receipt_number,
    status: row.status,
    statusSource: row.status_source
  };
}

function isDmvChoice(item: unknown): item is { key: string; label: string } {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  const value = item as Record<string, unknown>;
  return typeof value.key === "string" && typeof value.label === "string";
}

function mapDmvQuestion(row: DmvQuestionRow): DmvPracticeQuestion | null {
  const options = row.options;
  const choices = Array.isArray(options) && options.every(isDmvChoice) ? options.map((item) => ({ ...item })) : [];

  if (choices.length === 0) return null;

  return {
    answerKey: row.correct_option_key,
    choices,
    explanation: row.explanation,
    id: row.id,
    prompt: row.prompt,
    topic: row.topic
  };
}

function mapAutomation(row: FormDefinitionRow): AutomationFlow | null {
  const filingTypeByCode: Record<string, FilingType> = {
    ANNUAL_ASYLUM_FEE: "ANNUAL_ASYLUM_FEE",
    "AR-11": "AR11",
    "EOIR-33": "EOIR33",
    CHANGE_OF_VENUE: "CHANGE_OF_VENUE",
    "I-765": "I765_RENEWAL"
  };

  const filingType = filingTypeByCode[row.form_code];
  if (!filingType) return null;

  return {
    id: row.id,
    filingType,
    title: row.title,
    description: row.description,
    status: "not_started",
    progress: 0,
    legalReviewRequired: row.review_requirement !== "none"
  };
}

function mapPremiumService(row: PremiumServiceRow): PremiumService {
  return {
    id: row.id,
    serviceType: row.service_type,
    title: row.title,
    description: row.description,
    priceMode: row.price_mode,
    enabled: row.enabled
  };
}

function buildFolders(documents: VaultDocument[]): SmartFolder[] {
  if (documents.length === 0) return smartFolders;

  const counts = documents.reduce<Record<Agency, number>>(
    (acc, document) => {
      acc[document.agency] += 1;
      return acc;
    },
    { USCIS: 0, EOIR: 0, CBP: 0, DMV: 0, OTHER: 0 }
  );

  return (Object.entries(counts) as Array<[Agency, number]>)
    .filter(([, count]) => count > 0)
    .map(([agency, count]) => ({
      id: agency.toLowerCase(),
      label: agency === "OTHER" ? "Otros" : agency,
      agency,
      count,
      color: agencyColors[agency]
    }));
}

function buildDashboard(
  user: User | null,
  profile: ProfileRow | null,
  alerts: CriticalAlert[],
  documents: VaultDocument[],
  cases: CaseRow[]
): DashboardSummary {
  const documentsExpiring = documents.filter((document) => document.status === "expired").length;
  const activeCases = cases.filter((item) => item.status !== "closed" && item.status !== "archived").length;

  return {
    ...dashboardSummary,
    userName: getDisplayName(profile, user),
    totals: {
      documentsExpiring,
      pendingTasks: alerts.length,
      activeCases,
      newMessages: 0
    },
    alerts
  };
}

async function ensureProfile(user: User): Promise<ProfileRow | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        preferred_language: "es"
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) throw error;

  const metadataFullName =
    typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name.trim() : "";

  if (metadataFullName && !data.full_name) {
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ full_name: metadataFullName })
      .eq("id", user.id)
      .select("*")
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  return data;
}

function cleanStorageFileName(fileName: string): string {
  const normalized = fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "documento";
}

function localDateToIso(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

async function cachedDocumentObjectUrl(documentId: string): Promise<string | null> {
  if (typeof window === "undefined" || !("caches" in window)) return null;

  const cache = await window.caches.open("usa-latino-prime-documents-v1");
  const cached = await cache.match(`/offline-documents/${documentId}`);
  if (!cached) return null;

  const blob = await cached.blob();
  return URL.createObjectURL(blob);
}

function cleanAuthUrl() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const cleanPath = url.pathname === "/auth/callback" ? "/" : url.pathname;
  url.hash = "";
  url.searchParams.delete("code");
  url.searchParams.delete("type");
  window.history.replaceState(null, "", `${cleanPath}${url.search}`);
}

async function consumeAuthRedirect(): Promise<Session | null> {
  if (!supabase || typeof window === "undefined") return null;

  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (error) throw error;
    cleanAuthUrl();
    return data.session;
  }

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    cleanAuthUrl();
    return data.session;
  }

  return null;
}

export function useAppData(): AppData {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authBusy, setAuthBusy] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [generatedPacketUrl, setGeneratedPacketUrl] = useState<string | null>(null);
  const [packetMessage, setPacketMessage] = useState<string | null>(null);
  const [activeWorkflow, setActiveWorkflow] = useState<ActiveWorkflow | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary>(dashboardSummary);
  const [folders, setFolders] = useState<SmartFolder[]>(smartFolders);
  const [documents, setDocuments] = useState<VaultDocument[]>(recentDocuments);
  const [automations, setAutomations] = useState<AutomationFlow[]>(automationFlows);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [dmvQuestions, setDmvQuestions] = useState<DmvPracticeQuestion[]>([]);
  const [premiumServices, setPremiumServices] = useState<PremiumService[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;
    let mounted = true;

    async function initializeAuth() {
      try {
        const redirectedSession = await consumeAuthRedirect();
        const { data } = redirectedSession ? { data: { session: redirectedSession } } : await client.auth.getSession();

        if (!mounted) return;
        setSession(data.session);
      } catch (nextError) {
        if (mounted) setError(nextError instanceof Error ? nextError.message : "No se pudo validar el acceso.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void initializeAuth();

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const loadLiveData = useCallback(
    async (options?: { cancelled?: () => boolean }) => {
      if (!supabase || !session?.user) return;
      setLoading(true);
      setError(null);

      try {
        const liveProfile = await ensureProfile(session.user);
        const [criticalDatesResult, documentsResult, casesResult, formsResult, premiumServicesResult] =
          await Promise.all([
            supabase
              .from("critical_dates")
              .select("*")
              .is("acknowledged_at", null)
              .order("due_at", { ascending: true })
              .limit(12),
            supabase
              .from("user_documents")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(20),
            supabase.from("immigration_cases").select("*").order("updated_at", { ascending: false }),
            supabase.from("form_definitions").select("*").eq("enabled", true).order("agency").order("form_code"),
            supabase.from("premium_services").select("*").eq("enabled", true).order("title")
          ]);

        const results = [criticalDatesResult, documentsResult, casesResult, formsResult, premiumServicesResult];
        const failed = results.find((result) => result.error);
        if (failed?.error) throw failed.error;

        const liveAlerts = (criticalDatesResult.data ?? []).map(mapCriticalDate);
        const liveDocuments = (documentsResult.data ?? []).map(mapDocument);
        const liveCases = casesResult.data ?? [];
        const liveAutomations = (formsResult.data ?? []).map(mapAutomation).filter(Boolean) as AutomationFlow[];
        const livePremiumServices = (premiumServicesResult.data ?? []).map(mapPremiumService);
        let liveDmvQuestions: DmvPracticeQuestion[] = [];

        const stateCode = liveProfile?.state_code ?? "UT";
        const { data: dmvSet, error: dmvSetError } = await supabase
          .from("dmv_question_sets")
          .select("id")
          .eq("state_code", stateCode)
          .eq("language", "es")
          .eq("active", true)
          .order("verified_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (dmvSetError) throw dmvSetError;

        if (dmvSet?.id) {
          const { data: dmvRows, error: dmvQuestionsError } = await supabase
            .from("dmv_questions")
            .select("*")
            .eq("question_set_id", dmvSet.id)
            .order("created_at", { ascending: true });

          if (dmvQuestionsError) throw dmvQuestionsError;
          liveDmvQuestions = (dmvRows ?? []).map(mapDmvQuestion).filter(Boolean) as DmvPracticeQuestion[];
        }

        if (options?.cancelled?.()) return;

        setProfile(liveProfile);
        setDashboard(buildDashboard(session.user, liveProfile, liveAlerts, liveDocuments, liveCases));
        setDocuments(liveDocuments);
        setCases(liveCases.map(mapCase));
        setDmvQuestions(liveDmvQuestions);
        setFolders(buildFolders(liveDocuments));
        setAutomations(liveAutomations.length > 0 ? liveAutomations : automationFlows);
        setPremiumServices(livePremiumServices);
      } catch (nextError) {
        if (!options?.cancelled?.()) {
          setError(nextError instanceof Error ? nextError.message : "No se pudo cargar Supabase.");
        }
      } finally {
        if (!options?.cancelled?.()) setLoading(false);
      }
    },
    [session]
  );

  useEffect(() => {
    if (!supabase || !session?.user) return;

    let cancelled = false;
    void loadLiveData({ cancelled: () => cancelled });

    return () => {
      cancelled = true;
    };
  }, [loadLiveData, session]);

  const signInWithEmail = useCallback(async (email: string, fullName?: string, intent: AuthIntent = "signin") => {
    if (!supabase) {
      setError("Configura Supabase antes de iniciar sesion.");
      return;
    }

    setAuthBusy(true);
    setAuthMessage(null);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          data: intent === "signup" ? { full_name: fullName?.trim() || null } : undefined,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: intent === "signup"
        }
      });

      if (signInError) throw signInError;
      setAuthMessage("Te enviamos un enlace seguro. Al abrirlo volveras automaticamente al dashboard.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo enviar el enlace.");
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const startFormSession = useCallback(async (formCode: string) => {
    if (!supabase) {
      setError("Configura Supabase antes de iniciar un formulario.");
      return;
    }

    setWorkflowBusy(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("create-form-session", {
        body: {
          formCode,
          language: "es"
        }
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      setActiveWorkflow({
        formCode,
        questions: data.questions ?? [],
        sessionId: data.session.id,
        status: data.session.status
      });
      setGeneratedPacketUrl(null);
      setPacketMessage(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo iniciar el formulario.");
    } finally {
      setWorkflowBusy(false);
    }
  }, []);

  const completeOnboarding = useCallback(
    async (input: CompleteOnboardingInput) => {
      if (!supabase || !session?.user) {
        setError("Inicia sesion antes de completar tu perfil.");
        return;
      }

      setWorkflowBusy(true);
      setError(null);
      setPacketMessage(null);

      try {
        await ensureProfile(session.user);

        const now = new Date().toISOString();
        const { data, error: updateError } = await supabase
          .from("profiles")
          .update({
            full_name: input.fullName.trim(),
            legal_disclaimer_ack_at: now,
            onboarding_completed_at: now,
            privacy_consent_version: "2026-05",
            privacy_consented_at: now,
            state_code: input.stateCode.trim().toUpperCase()
          })
          .eq("id", session.user.id)
          .select("*")
          .single();

        if (updateError) throw updateError;

        setProfile(data);
        setDashboard((current) => buildDashboard(session.user, data, current.alerts, documents, []));
        setPacketMessage("Perfil guardado. Ya puedes usar la boveda, fechas y formularios.");
        await loadLiveData();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "No se pudo guardar el perfil.");
      } finally {
        setWorkflowBusy(false);
      }
    },
    [documents, loadLiveData, session]
  );

  const uploadDocument = useCallback(
    async (input: UploadDocumentInput) => {
      if (!supabase || !session?.user) {
        setError("Inicia sesion antes de subir documentos.");
        return;
      }

      setWorkflowBusy(true);
      setError(null);
      setPacketMessage(null);

      try {
        const cleanName = cleanStorageFileName(input.file.name || "documento");
        const storagePath = `${session.user.id}/${Date.now()}-${cleanName}`;
        const mimeType = input.file.type || "application/octet-stream";

        const { error: uploadError } = await supabase.storage
          .from("user-documents")
          .upload(storagePath, input.file, {
            cacheControl: "3600",
            contentType: mimeType,
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: document, error: insertError } = await supabase
          .from("user_documents")
          .insert({
            agency: "OTHER",
            doc_type: "OTHER",
            extracted_fields: {},
            mime_type: mimeType,
            offline_allowed: true,
            size_bytes: input.file.size,
            status: "uploaded",
            storage_bucket: "user-documents",
            storage_path: storagePath,
            title: input.title?.trim() || input.file.name || "Documento",
            user_id: session.user.id
          })
          .select("*")
          .single();

        if (insertError) throw insertError;

        const { data, error: invokeError } = await supabase.functions.invoke("classify-document", {
          body: {
            documentId: document.id,
            fileName: input.file.name,
            ocrText: input.ocrText
          }
        });

        if (invokeError || data?.error) {
          setPacketMessage("Documento guardado. La clasificacion quedo pendiente para revision.");
        } else {
          setPacketMessage("Documento guardado y clasificado en la boveda.");
        }

        await loadLiveData();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "No se pudo subir el documento.");
      } finally {
        setWorkflowBusy(false);
      }
    },
    [loadLiveData, session]
  );

  const addCriticalDate = useCallback(
    async (input: AddCriticalDateInput) => {
      if (!supabase || !session?.user) {
        setError("Inicia sesion antes de agregar fechas.");
        return;
      }

      setWorkflowBusy(true);
      setError(null);
      setPacketMessage(null);

      try {
        const { error: insertError } = await supabase.from("critical_dates").insert({
          details: input.details?.trim() || null,
          due_at: localDateToIso(input.dueDate),
          kind: input.kind,
          severity: input.severity,
          source: input.source,
          title: input.title.trim(),
          user_id: session.user.id
        });

        if (insertError) throw insertError;

        setPacketMessage("Fecha critica agregada al semaforo.");
        await loadLiveData();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "No se pudo agregar la fecha.");
      } finally {
        setWorkflowBusy(false);
      }
    },
    [loadLiveData, session]
  );

  const addCase = useCallback(
    async (input: AddCaseInput) => {
      if (!supabase || !session?.user) {
        setError("Inicia sesion antes de agregar casos.");
        return;
      }

      setWorkflowBusy(true);
      setError(null);
      setPacketMessage(null);

      try {
        const { error: insertError } = await supabase.from("immigration_cases").insert({
          agency: input.agency,
          form_code: input.formCode?.trim() || null,
          receipt_number: input.receiptNumber.trim().toUpperCase().replace(/\s+/g, ""),
          status: "registered",
          status_source: "USER",
          user_id: session.user.id
        });

        if (insertError) throw insertError;

        setPacketMessage("Caso guardado. El monitoreo automatico se activa cuando conectemos credenciales oficiales.");
        await loadLiveData();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "No se pudo agregar el caso.");
      } finally {
        setWorkflowBusy(false);
      }
    },
    [loadLiveData, session]
  );

  const acknowledgeAlert = useCallback(
    async (alertId: string) => {
      if (!supabase) {
        setDashboard((current) => ({
          ...current,
          alerts: current.alerts.filter((alert) => alert.id !== alertId),
          totals: {
            ...current.totals,
            pendingTasks: Math.max(0, current.totals.pendingTasks - 1)
          }
        }));
        return;
      }

      setWorkflowBusy(true);
      setError(null);
      setPacketMessage(null);

      try {
        const { error: updateError } = await supabase
          .from("critical_dates")
          .update({ acknowledged_at: new Date().toISOString() })
          .eq("id", alertId);

        if (updateError) throw updateError;

        setPacketMessage("Alerta marcada como atendida.");
        await loadLiveData();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "No se pudo actualizar la alerta.");
      } finally {
        setWorkflowBusy(false);
      }
    },
    [loadLiveData]
  );

  const openDocument = useCallback(async (documentId: string): Promise<string | null> => {
    if (!supabase) {
      setError("Configura Supabase antes de abrir documentos.");
      return null;
    }

    setWorkflowBusy(true);
    setError(null);
    setPacketMessage(null);

    try {
      const cachedUrl = await cachedDocumentObjectUrl(documentId);
      if (cachedUrl && typeof navigator !== "undefined" && !navigator.onLine) {
        return cachedUrl;
      }

      const { data: document, error: documentError } = await supabase
        .from("user_documents")
        .select("storage_bucket, storage_path")
        .eq("id", documentId)
        .single();

      if (documentError || !document) throw documentError ?? new Error("Documento no encontrado.");

      const { data: signed, error: signedError } = await supabase.storage
        .from(document.storage_bucket)
        .createSignedUrl(document.storage_path, 600);

      if (signedError) throw signedError;
      return signed.signedUrl;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo abrir el documento.");
      return null;
    } finally {
      setWorkflowBusy(false);
    }
  }, []);

  const cacheDocumentOffline = useCallback(async (documentId: string) => {
    if (!supabase) {
      setError("Configura Supabase antes de guardar offline.");
      return;
    }

    if (typeof window === "undefined" || !("caches" in window)) {
      setError("Este navegador no soporta cache offline.");
      return;
    }

    setWorkflowBusy(true);
    setError(null);
    setPacketMessage(null);

    try {
      const documentUrl = await openDocument(documentId);
      if (!documentUrl) return;

      const response = await fetch(documentUrl);
      if (!response.ok) throw new Error("No se pudo descargar el documento para offline.");

      const blob = await response.blob();
      const cache = await window.caches.open("usa-latino-prime-documents-v1");
      await cache.put(
        `/offline-documents/${documentId}`,
        new Response(blob, {
          headers: {
            "Content-Type": blob.type || "application/octet-stream"
          }
        })
      );

      setPacketMessage("Documento guardado para consulta offline en este dispositivo.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo guardar offline.");
    } finally {
      setWorkflowBusy(false);
    }
  }, [openDocument]);

  const refreshCaseStatus = useCallback(
    async (caseId: string) => {
      if (!supabase) {
        setError("Configura Supabase antes de consultar casos.");
        return;
      }

      setWorkflowBusy(true);
      setError(null);
      setPacketMessage(null);

      try {
        const { data, error: invokeError } = await supabase.functions.invoke("uscis-case-status", {
          body: {
            caseId
          }
        });

        if (data?.error === "uscis_api_not_configured") {
          setPacketMessage("Caso guardado. Falta conectar credenciales oficiales USCIS para consulta en tiempo real.");
          return;
        }

        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(data.error);

        setPacketMessage(`Estatus USCIS actualizado: ${data.status ?? "recibido"}.`);
        await loadLiveData();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "No se pudo consultar USCIS.");
      } finally {
        setWorkflowBusy(false);
      }
    },
    [loadLiveData]
  );

  const generatePdfPacket = useCallback(async (sessionId: string) => {
    if (!supabase) {
      setError("Configura Supabase antes de generar PDFs.");
      return;
    }

    setWorkflowBusy(true);
    setError(null);
    setPacketMessage(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("generate-pdf-packet", {
        body: {
          sessionId
        }
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      const storagePath = data?.packet?.storage_path as string | undefined;

      if (storagePath) {
        const { data: signed, error: signedError } = await supabase.storage
          .from("generated-packets")
          .createSignedUrl(storagePath, 600);

        if (signedError) throw signedError;
        setGeneratedPacketUrl(signed.signedUrl);
      }

      const packetKind = data?.packet_kind as string | undefined;
      const nextStatus = data?.next_status as string | undefined;

      if (packetKind === "official_pdf") {
        setPacketMessage("PDF oficial generado. Debe revisarse y firmarse antes de enviarlo.");
      } else if (nextStatus === "needs_expert_review") {
        setPacketMessage("Paquete de preparacion generado y enviado a revision humana.");
      } else {
        setPacketMessage("Paquete de preparacion generado. Usa el canal oficial indicado para presentar o pagar.");
      }

      setActiveWorkflow((current) =>
        current && current.sessionId === sessionId ? { ...current, status: nextStatus ?? "exported" } : current
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo generar el PDF.");
    } finally {
      setWorkflowBusy(false);
    }
  }, []);

  const saveFormAnswer = useCallback(async (sessionId: string, questionKey: string, answer: unknown) => {
    if (!supabase) return;

    setWorkflowBusy(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("save-form-answer", {
        body: {
          answer,
          questionKey,
          sessionId
        }
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      setActiveWorkflow((current) =>
        current && current.sessionId === sessionId ? { ...current, status: data.session.status } : current
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo guardar la respuesta.");
    } finally {
      setWorkflowBusy(false);
    }
  }, []);

  const requestPremiumService = useCallback(async (serviceType: PremiumServiceType) => {
    if (!supabase) {
      setError("Configura Supabase antes de solicitar servicios.");
      return;
    }

    setWorkflowBusy(true);
    setError(null);
    setPacketMessage(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          serviceType
        }
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setPacketMessage("Solicitud gratuita creada para probar el flujo.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo crear la solicitud.");
    } finally {
      setWorkflowBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setActiveWorkflow(null);
    setGeneratedPacketUrl(null);
    setPacketMessage(null);
    setProfile(null);
    setDashboard(dashboardSummary);
    setDocuments(recentDocuments);
    setCases([]);
    setDmvQuestions([]);
    setFolders(smartFolders);
    setAutomations(automationFlows);
  }, []);

  const mode = useMemo<DataMode>(() => {
    if (!isSupabaseConfigured) return "preview";
    if (!session) return "auth_required";
    return "live";
  }, [session]);

  return {
    mode,
    activeWorkflow,
    loading,
    authBusy,
    workflowBusy,
    error,
    authMessage,
    generatedPacketUrl,
    packetMessage,
    session,
    user: session?.user ?? null,
    profile,
    needsOnboarding:
      mode === "live" &&
      !loading &&
      (!profile?.onboarding_completed_at || !profile.legal_disclaimer_ack_at || !profile.privacy_consented_at),
    dashboard,
    folders,
    documents,
    automations,
    cases,
    dmvQuestions,
    premiumServices,
    addCase,
    addCriticalDate,
    acknowledgeAlert,
    cacheDocumentOffline,
    completeOnboarding,
    generatePdfPacket,
    openDocument,
    refreshCaseStatus,
    saveFormAnswer,
    signInWithEmail,
    signOut,
    requestPremiumService,
    startFormSession,
    uploadDocument
  };
}
