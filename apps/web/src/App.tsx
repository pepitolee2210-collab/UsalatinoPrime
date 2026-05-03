import {
  Bell,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Cloud,
  CreditCard,
  Database,
  FileCheck2,
  FileText,
  Folder,
  Grid2X2,
  Home,
  Landmark,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
  Zap
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  Agency,
  AlertKind,
  AutomationFlow,
  CriticalAlert,
  DashboardSummary,
  PremiumService,
  PremiumServiceType,
  SmartFolder,
  StatusSeverity,
  VaultDocument
} from "@usa-latino-prime/shared";
import { resourceRows } from "./data/demo";
import {
  useAppData,
  type ActiveWorkflow,
  type AddCaseInput,
  type AddCriticalDateInput,
  type CaseSummary,
  type CompleteOnboardingInput,
  type DmvPracticeQuestion,
  type UploadDocumentInput,
  type UserProfile
} from "./hooks/useAppData";

type TabId = "home" | "documents" | "automation" | "utilities" | "more";
type DataMode = "preview" | "auth_required" | "live";

const tabs: Array<{ id: TabId; label: string; icon: typeof Home }> = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "automation", label: "Automatiza", icon: Zap },
  { id: "utilities", label: "Utilidades", icon: Grid2X2 },
  { id: "more", label: "Mas", icon: Menu }
];

const tabIds = new Set<TabId>(["home", "documents", "automation", "utilities", "more"]);

const stateOptions = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"]
] as const;

function getInitialTab(): TabId {
  if (typeof window === "undefined") {
    return "home";
  }

  const tab = new URLSearchParams(window.location.search).get("tab");
  return tabIds.has(tab as TabId) ? (tab as TabId) : "home";
}

const severityLabel: Record<StatusSeverity, string> = {
  green: "Estatus estable",
  yellow: "Requiere atencion",
  red: "Accion urgente"
};

const severityCopy: Record<StatusSeverity, string> = {
  green: "Sin riesgos criticos ahora.",
  yellow: "Hay fechas proximas que conviene revisar.",
  red: "Revisa y confirma tus acciones pendientes."
};

const statusOrder: StatusSeverity[] = ["green", "yellow", "red"];

function getWorstSeverity(alerts: CriticalAlert[]): StatusSeverity {
  if (alerts.some((alert) => alert.severity === "red")) return "red";
  if (alerts.some((alert) => alert.severity === "yellow")) return "yellow";
  return "green";
}

function formCodeForFlow(flow: AutomationFlow): string {
  if (flow.filingType === "ANNUAL_ASYLUM_FEE") return "ANNUAL_ASYLUM_FEE";
  if (flow.filingType === "AR11") return "AR-11";
  if (flow.filingType === "EOIR33") return "EOIR-33";
  if (flow.filingType === "I765_RENEWAL") return "I-765";
  return flow.filingType;
}

export function App() {
  const appData = useAppData();
  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);

  const currentStatus = useMemo(() => getWorstSeverity(appData.dashboard.alerts), [appData.dashboard.alerts]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "home") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.replaceState(null, "", url);
  };

  const renderScreen = () => {
    if (appData.mode === "auth_required") {
      return (
        <AuthScreen
          authBusy={appData.authBusy}
          authMessage={appData.authMessage}
          error={appData.error}
          onSignIn={appData.signInWithEmail}
        />
      );
    }

    if (appData.mode === "live" && appData.loading && !appData.profile) {
      return <LoadingScreen />;
    }

    if (appData.mode === "live" && appData.needsOnboarding) {
      return (
        <OnboardingScreen
          error={appData.error}
          loading={appData.workflowBusy}
          onComplete={appData.completeOnboarding}
          profile={appData.profile}
        />
      );
    }

    switch (activeTab) {
      case "documents":
        return (
          <DocumentVault
            documents={appData.documents}
            folders={appData.folders}
            loading={appData.loading}
            message={appData.packetMessage}
            onCacheDocumentOffline={appData.cacheDocumentOffline}
            onOpenDocument={appData.openDocument}
            onUploadDocument={appData.uploadDocument}
            workflowBusy={appData.workflowBusy}
          />
        );
      case "automation":
        return (
          <AutomationCenter
            activeWorkflow={appData.activeWorkflow}
            flows={appData.automations}
            generatedPacketUrl={appData.generatedPacketUrl}
            loading={appData.loading}
            onGeneratePacket={appData.generatePdfPacket}
            onSaveAnswer={appData.saveFormAnswer}
            onStart={appData.startFormSession}
            packetMessage={appData.packetMessage}
            workflowBusy={appData.workflowBusy}
          />
        );
      case "utilities":
        return <UtilityHub dmvQuestions={appData.dmvQuestions} />;
      case "more":
        return (
          <MorePanel
            message={appData.packetMessage}
            onRequestService={appData.requestPremiumService}
            services={appData.premiumServices}
            workflowBusy={appData.workflowBusy}
          />
        );
      default:
        return (
          <Dashboard
            alerts={appData.dashboard.alerts}
            cases={appData.cases}
            dataMode={appData.mode}
            error={appData.error}
            loading={appData.loading}
            message={appData.packetMessage}
            onAcknowledge={appData.acknowledgeAlert}
            onAddCase={appData.addCase}
            onAddCriticalDate={appData.addCriticalDate}
            onRefreshCaseStatus={appData.refreshCaseStatus}
            status={currentStatus}
            summary={appData.dashboard}
            workflowBusy={appData.workflowBusy}
          />
        );
    }
  };

  return (
    <div className="app-frame">
      <div className="phone-shell">
        <AppHeader dataMode={appData.mode} email={appData.user?.email ?? null} onSignOut={appData.signOut} />
        <div className="screen-content">{renderScreen()}</div>
        <BottomNav activeTab={activeTab} onChange={handleTabChange} />
      </div>
      <aside className="desktop-brief" aria-label="Resumen operativo">
        <div className="brief-panel">
          <p className="brief-kicker">Fundacion productiva</p>
          <h2>Control migratorio, documentos y tramites conectado a Supabase.</h2>
          <p>
            Esta etapa ya usa Auth, RLS, storage privado y catalogo oficial versionado para escalar hacia
            automatizaciones, alertas push y revision humana de prueba.
          </p>
          <div className="brief-grid">
            <span>Supabase Auth</span>
            <span>RLS activo</span>
            <span>Storage privado</span>
            <span>Gratis por ahora</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function AppHeader({
  dataMode,
  email,
  onSignOut
}: {
  dataMode: DataMode;
  email: string | null;
  onSignOut: () => Promise<void>;
}) {
  return (
    <header className="app-header">
      <button className="icon-button" aria-label="Perfil">
        <UserRound size={18} />
      </button>
      <div className="brand-lockup">
        <span className="brand-mark">U</span>
        <div>
          <strong>USA Latino</strong>
          <small>Prime</small>
        </div>
      </div>
      <button
        className={`icon-button ${dataMode === "live" ? "" : "alert-dot"}`}
        aria-label={email ? "Cerrar sesion" : "Notificaciones"}
        onClick={() => {
          if (email) void onSignOut();
        }}
      >
        {email ? <LogOut size={18} /> : <Bell size={18} />}
      </button>
    </header>
  );
}

function Dashboard({
  status,
  summary,
  alerts,
  cases,
  dataMode,
  loading,
  error,
  message,
  onAcknowledge,
  onAddCase,
  onAddCriticalDate,
  onRefreshCaseStatus,
  workflowBusy
}: {
  status: StatusSeverity;
  summary: DashboardSummary;
  alerts: CriticalAlert[];
  cases: CaseSummary[];
  dataMode: DataMode;
  loading: boolean;
  error: string | null;
  message: string | null;
  onAcknowledge: (id: string) => void;
  onAddCase: (input: AddCaseInput) => Promise<void>;
  onAddCriticalDate: (input: AddCriticalDateInput) => Promise<void>;
  onRefreshCaseStatus: (caseId: string) => Promise<void>;
  workflowBusy: boolean;
}) {
  return (
    <main className="screen-stack">
      <DataModeBanner error={error} loading={loading} mode={dataMode} />
      {message ? <p className="form-success">{message}</p> : null}

      <section className={`status-panel status-${status}`} aria-label="Semaforo de estatus">
        <div className="traffic-light" aria-hidden="true">
          {statusOrder.map((item) => (
            <span key={item} className={item === status ? "active" : ""} />
          ))}
        </div>
        <div className="status-copy">
          <span>Semaforo de estatus</span>
          <h1>{severityLabel[status]}</h1>
          <p>{severityCopy[status]}</p>
          <button className="text-action">
            Ver detalles <ChevronRight size={16} />
          </button>
        </div>
      </section>

      <DashboardActionPanel
        onAddCase={onAddCase}
        onAddCriticalDate={onAddCriticalDate}
        workflowBusy={workflowBusy}
      />

      <CaseStatusPanel cases={cases} onRefreshCaseStatus={onRefreshCaseStatus} workflowBusy={workflowBusy} />

      <section className="section-block">
        <div className="section-heading">
          <h2>Proximos eventos</h2>
          <button>Ordenar</button>
        </div>
        <div className="alert-list">
          {alerts.length === 0 ? (
            <div className="empty-state">
              <ShieldCheck size={22} />
              <strong>No hay alertas pendientes.</strong>
              <span>Tu panel queda en verde hasta el proximo cambio.</span>
            </div>
          ) : (
            alerts.map((alert) => (
              <article className={`alert-card alert-${alert.severity}`} key={alert.id}>
                <IconTile severity={alert.severity} kind={alert.kind} />
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </div>
                <button onClick={() => void onAcknowledge(alert.id)} aria-label={`Marcar ${alert.title}`}>
                  {alert.dueLabel}
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="section-block">
        <h2>Resumen rapido</h2>
        <div className="metric-grid">
          <Metric value={summary.totals.documentsExpiring} label="Docs por vencer" />
          <Metric value={summary.totals.pendingTasks} label="Tareas pendientes" />
          <Metric value={summary.totals.activeCases} label="Casos activos" />
          <Metric value={summary.totals.newMessages} label="Mensajes nuevos" />
        </div>
      </section>

      <div className="security-note">
        <Lock size={16} />
        <span>Tus datos estan cifrados y protegidos.</span>
      </div>

      <p className="legal-note">USA Latino Prime no es un bufete de abogados y no brinda asesoria legal.</p>
    </main>
  );
}

function maskReceipt(value: string | null): string {
  if (!value) return "Sin recibo";
  if (value.length <= 6) return value;
  return `${value.slice(0, 3)}...${value.slice(-4)}`;
}

function CaseStatusPanel({
  cases,
  onRefreshCaseStatus,
  workflowBusy
}: {
  cases: CaseSummary[];
  onRefreshCaseStatus: (caseId: string) => Promise<void>;
  workflowBusy: boolean;
}) {
  return (
    <section className="section-block">
      <div className="section-heading">
        <h2>Casos rastreados</h2>
        <span className="mini-status">USCIS</span>
      </div>
      <div className="case-list">
        {cases.length === 0 ? (
          <div className="empty-state compact-empty">
            <Landmark size={22} />
            <strong>No hay casos guardados.</strong>
            <span>Agrega un numero de recibo para iniciar seguimiento.</span>
          </div>
        ) : (
          cases.map((item) => (
            <article className="case-row" key={item.id}>
              <div className="case-icon">
                <Landmark size={20} />
              </div>
              <div>
                <strong>{item.formCode || item.agency}</strong>
                <span>
                  {maskReceipt(item.receiptNumber)} . {item.status.replaceAll("_", " ")}
                </span>
                <small>
                  {item.lastCheckedAt
                    ? `Consultado ${new Date(item.lastCheckedAt).toLocaleDateString("es-US")}`
                    : "Pendiente de consulta oficial"}
                </small>
              </div>
              <button className="mini-action" disabled={workflowBusy} onClick={() => void onRefreshCaseStatus(item.id)}>
                Refrescar
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function LoadingScreen() {
  return (
    <main className="screen-stack auth-screen">
      <section className="auth-panel">
        <div className="auth-hero">
          <div className="auth-icon">
            <Loader2 className="spin" size={34} />
          </div>
          <div>
            <span>Sesion protegida</span>
            <h1>Cargando tu panel</h1>
            <p>Estamos preparando tus documentos, alertas y servicios conectados a Supabase.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function OnboardingScreen({
  error,
  loading,
  onComplete,
  profile
}: {
  error: string | null;
  loading: boolean;
  onComplete: (input: CompleteOnboardingInput) => Promise<void>;
  profile: UserProfile | null;
}) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [stateCode, setStateCode] = useState(profile?.state_code ?? "UT");
  const [accepted, setAccepted] = useState(false);

  return (
    <main className="screen-stack auth-screen">
      <section className="onboarding-panel">
        <div className="auth-hero">
          <div className="auth-icon">
            <ShieldCheck size={34} />
          </div>
          <div>
            <span>Primer acceso</span>
            <h1>Configura tu cuenta</h1>
            <p>Esto activa la boveda privada, alertas y formularios con tu estado base.</p>
          </div>
        </div>

        <form
          className="field-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void onComplete({ fullName, stateCode });
          }}
        >
          <label htmlFor="onboarding-name">
            Nombre completo
            <input
              autoComplete="name"
              id="onboarding-name"
              onChange={(event) => setFullName(event.target.value)}
              required
              type="text"
              value={fullName}
            />
          </label>

          <label htmlFor="onboarding-state">
            Estado principal
            <select id="onboarding-state" onChange={(event) => setStateCode(event.target.value)} value={stateCode}>
              {stateOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="consent-row" htmlFor="legal-consent">
            <input
              checked={accepted}
              id="legal-consent"
              onChange={(event) => setAccepted(event.target.checked)}
              required
              type="checkbox"
            />
            <span>
              Entiendo que esta app organiza documentos y formularios, pero no reemplaza asesoria legal.
            </span>
          </label>

          <button className="primary-button" disabled={loading || !accepted} type="submit">
            {loading ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
            Activar mi panel
          </button>
        </form>

        {error ? <p className="form-error">{error}</p> : null}
      </section>
    </main>
  );
}

function DashboardActionPanel({
  onAddCase,
  onAddCriticalDate,
  workflowBusy
}: {
  onAddCase: (input: AddCaseInput) => Promise<void>;
  onAddCriticalDate: (input: AddCriticalDateInput) => Promise<void>;
  workflowBusy: boolean;
}) {
  const [mode, setMode] = useState<"date" | "case">("date");

  return (
    <section className="action-panel">
      <div className="action-segment" aria-label="Acciones rapidas">
        <button className={mode === "date" ? "active" : ""} onClick={() => setMode("date")} type="button">
          <CalendarDays size={15} />
          Fecha
        </button>
        <button className={mode === "case" ? "active" : ""} onClick={() => setMode("case")} type="button">
          <Landmark size={15} />
          Caso USCIS
        </button>
      </div>
      {mode === "date" ? (
        <CriticalDateForm onSubmit={onAddCriticalDate} saving={workflowBusy} />
      ) : (
        <CaseForm onSubmit={onAddCase} saving={workflowBusy} />
      )}
    </section>
  );
}

function CriticalDateForm({
  onSubmit,
  saving
}: {
  onSubmit: (input: AddCriticalDateInput) => Promise<void>;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [kind, setKind] = useState<AlertKind>("filing_deadline");
  const [source, setSource] = useState<Agency>("USCIS");
  const [severity, setSeverity] = useState<StatusSeverity>("yellow");
  const [details, setDetails] = useState("");

  return (
    <form
      className="field-grid compact"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({ details, dueDate, kind, severity, source, title }).then(() => {
          setTitle("");
          setDueDate("");
          setDetails("");
        });
      }}
    >
      <label htmlFor="date-title">
        Titulo
        <input
          id="date-title"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Audiencia, biometria, vencimiento..."
          required
          type="text"
          value={title}
        />
      </label>
      <label htmlFor="date-due">
        Fecha
        <input id="date-due" onChange={(event) => setDueDate(event.target.value)} required type="date" value={dueDate} />
      </label>
      <label htmlFor="date-kind">
        Tipo
        <select id="date-kind" onChange={(event) => setKind(event.target.value as AlertKind)} value={kind}>
          <option value="court_hearing">Audiencia</option>
          <option value="ead_expiration">Vence permiso</option>
          <option value="biometrics">Biometria</option>
          <option value="filing_deadline">Fecha limite</option>
          <option value="address_change">Cambio direccion</option>
        </select>
      </label>
      <label htmlFor="date-severity">
        Urgencia
        <select id="date-severity" onChange={(event) => setSeverity(event.target.value as StatusSeverity)} value={severity}>
          <option value="green">Verde</option>
          <option value="yellow">Amarillo</option>
          <option value="red">Rojo</option>
        </select>
      </label>
      <label htmlFor="date-source">
        Agencia
        <select id="date-source" onChange={(event) => setSource(event.target.value as Agency)} value={source}>
          <option value="USCIS">USCIS</option>
          <option value="EOIR">EOIR</option>
          <option value="CBP">CBP</option>
          <option value="DMV">DMV</option>
          <option value="OTHER">Otra</option>
        </select>
      </label>
      <label className="wide-field" htmlFor="date-details">
        Detalle
        <textarea
          id="date-details"
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Notas utiles para recordar la accion"
          rows={2}
          value={details}
        />
      </label>
      <button className="primary-button wide-field" disabled={saving} type="submit">
        {saving ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
        Agregar fecha
      </button>
    </form>
  );
}

function CaseForm({ onSubmit, saving }: { onSubmit: (input: AddCaseInput) => Promise<void>; saving: boolean }) {
  const [receiptNumber, setReceiptNumber] = useState("");
  const [formCode, setFormCode] = useState("");

  return (
    <form
      className="field-grid compact"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({ agency: "USCIS", formCode, receiptNumber }).then(() => {
          setReceiptNumber("");
          setFormCode("");
        });
      }}
    >
      <label className="wide-field" htmlFor="case-receipt">
        Numero de recibo USCIS
        <input
          id="case-receipt"
          onChange={(event) => setReceiptNumber(event.target.value)}
          placeholder="IOE1234567890"
          required
          type="text"
          value={receiptNumber}
        />
      </label>
      <label className="wide-field" htmlFor="case-form">
        Formulario opcional
        <input
          id="case-form"
          onChange={(event) => setFormCode(event.target.value)}
          placeholder="I-765, I-130, I-485..."
          type="text"
          value={formCode}
        />
      </label>
      <button className="primary-button wide-field" disabled={saving} type="submit">
        {saving ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
        Guardar caso
      </button>
    </form>
  );
}

function AuthScreen({
  authBusy,
  authMessage,
  error,
  onSignIn
}: {
  authBusy: boolean;
  authMessage: string | null;
  error: string | null;
  onSignIn: (email: string, fullName?: string, intent?: "signin" | "signup") => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");

  return (
    <main className="screen-stack auth-screen">
      <section className="auth-panel">
        <div className="auth-hero">
          <div className="auth-icon">
            <ShieldCheck size={34} />
          </div>
          <div>
            <span>Centro de Control Migratorio</span>
            <h1>{authMode === "signup" ? "Crea tu cuenta segura" : "Entra a tu cuenta"}</h1>
            <p>Usa un enlace privado por correo. No necesitas contrasena para esta prueba.</p>
          </div>
        </div>

        <div className="auth-segment" role="tablist" aria-label="Modo de acceso">
          <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")} type="button">
            Crear cuenta
          </button>
          <button className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")} type="button">
            Ya tengo cuenta
          </button>
        </div>

        <div className="auth-benefits" aria-label="Beneficios de cuenta">
          <span>
            <Lock size={14} />
            Boveda privada
          </span>
          <span>
            <Bell size={14} />
            Alertas criticas
          </span>
          <span>
            <FileCheck2 size={14} />
            PDFs oficiales
          </span>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onSignIn(email, fullName, authMode);
          }}
        >
          {authMode === "signup" ? (
            <>
              <label htmlFor="full-name">Nombre completo</label>
              <input
                autoComplete="name"
                id="full-name"
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Tu nombre legal"
                required
                type="text"
                value={fullName}
              />
            </>
          ) : null}
          <label htmlFor="email">Correo electronico</label>
          <input
            autoComplete="email"
            id="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@email.com"
            required
            type="email"
            value={email}
          />
          <button className="primary-button" disabled={authBusy} type="submit">
            {authBusy ? <Loader2 className="spin" size={16} /> : <LogIn size={16} />}
            {authMode === "signup" ? "Crear acceso seguro" : "Entrar"}
          </button>
        </form>
        {authMessage ? <p className="form-success">{authMessage}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </section>
    </main>
  );
}

function DataModeBanner({ mode, loading, error }: { mode: DataMode; loading: boolean; error: string | null }) {
  if (error) {
    return (
      <div className="data-banner error">
        <Database size={16} />
        <span>{error}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="data-banner">
        <Loader2 className="spin" size={16} />
        <span>Cargando datos protegidos...</span>
      </div>
    );
  }

  return (
    <div className={`data-banner ${mode}`}>
      <Cloud size={16} />
      <span>{mode === "live" ? "Conectado a Supabase" : "Vista local de previsualizacion"}</span>
    </div>
  );
}

function DocumentVault({
  documents,
  folders,
  loading,
  message,
  onCacheDocumentOffline,
  onOpenDocument,
  onUploadDocument,
  workflowBusy
}: {
  documents: VaultDocument[];
  folders: SmartFolder[];
  loading: boolean;
  message: string | null;
  onCacheDocumentOffline: (documentId: string) => Promise<void>;
  onOpenDocument: (documentId: string) => Promise<string | null>;
  onUploadDocument: (input: UploadDocumentInput) => Promise<void>;
  workflowBusy: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [ocrText, setOcrText] = useState("");

  return (
    <main className="screen-stack light-screen">
      <TopBar title="Mis documentos" />
      <section className="vault-banner">
        <ShieldCheck size={30} />
        <div>
          <strong>Boveda segura</strong>
          <span>Tus documentos cifrados y disponibles.</span>
        </div>
        <Lock size={18} />
      </section>

      <section className="upload-panel">
        <div className="section-heading">
          <h2>Agregar documento</h2>
          <span className="mini-status">Storage privado</span>
        </div>
        <form
          className="field-grid compact"
          onSubmit={(event) => {
            event.preventDefault();
            if (!file) return;
            void onUploadDocument({ file, ocrText, title }).then(() => {
              setFile(null);
              setTitle("");
              setOcrText("");
              event.currentTarget.reset();
            });
          }}
        >
          <label className="wide-field" htmlFor="document-title">
            Nombre para la boveda
            <input
              id="document-title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Recibo I-765"
              type="text"
              value={title}
            />
          </label>
          <label className="wide-field file-drop" htmlFor="document-file">
            <FileText size={20} />
            <span>{file ? file.name : "Seleccionar PDF o imagen"}</span>
            <input
              accept="application/pdf,image/*"
              id="document-file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
              type="file"
            />
          </label>
          <label className="wide-field" htmlFor="document-ocr">
            Texto detectado opcional
            <textarea
              id="document-ocr"
              onChange={(event) => setOcrText(event.target.value)}
              placeholder="Pega texto si lo tienes. Ayuda a clasificar I-94, I-797, I-765 o corte."
              rows={2}
              value={ocrText}
            />
          </label>
          <button className="primary-button wide-field" disabled={workflowBusy || !file} type="submit">
            {workflowBusy ? <Loader2 className="spin" size={16} /> : <Cloud size={16} />}
            Subir y clasificar
          </button>
        </form>
        {message ? <p className="form-success">{message}</p> : null}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Carpetas inteligentes</h2>
          <button>Ver todas</button>
        </div>
        <div className="folder-list">
          {folders.map((folder) => (
            <button className="folder-row" key={folder.id}>
              <Folder fill={folder.color} color={folder.color} size={30} />
              <span>
                <strong>{folder.label}</strong>
                <small>{folder.count} documentos</small>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Documentos recientes</h2>
          <button>Ver todos</button>
        </div>
        <div className="document-list">
          {loading ? (
            <div className="empty-state">
              <Loader2 className="spin" size={22} />
              <strong>Cargando documentos.</strong>
              <span>Validando tu sesion segura.</span>
            </div>
          ) : documents.length === 0 ? (
            <div className="empty-state">
              <FileText size={22} />
              <strong>No hay documentos cargados.</strong>
              <span>Escanea tu primer documento desde la boveda.</span>
            </div>
          ) : (
            documents.map((doc) => (
              <article className="document-row" key={doc.id}>
                <FileText size={28} />
                <div>
                  <strong>{doc.title}</strong>
                  <span>
                    {doc.agency} . {new Date(doc.capturedAt).toLocaleDateString("es-US")}
                  </span>
                </div>
                <small className={`status-chip ${doc.status}`}>{doc.agency}</small>
                <div className="document-actions">
                  <button
                    className="mini-action"
                    disabled={workflowBusy}
                    onClick={() => {
                      void onOpenDocument(doc.id).then((url) => {
                        if (url) window.open(url, "_blank", "noopener,noreferrer");
                      });
                    }}
                  >
                    Abrir
                  </button>
                  <button
                    className="mini-action"
                    disabled={workflowBusy}
                    onClick={() => void onCacheDocumentOffline(doc.id)}
                  >
                    Offline
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function AutomationCenter({
  activeWorkflow,
  flows,
  generatedPacketUrl,
  loading,
  onGeneratePacket,
  onSaveAnswer,
  onStart,
  packetMessage,
  workflowBusy
}: {
  activeWorkflow: ActiveWorkflow | null;
  flows: AutomationFlow[];
  generatedPacketUrl: string | null;
  loading: boolean;
  onGeneratePacket: (sessionId: string) => Promise<void>;
  onSaveAnswer: (sessionId: string, questionKey: string, answer: unknown) => Promise<void>;
  onStart: (formCode: string) => Promise<void>;
  packetMessage: string | null;
  workflowBusy: boolean;
}) {
  return (
    <main className="screen-stack light-screen">
      <TopBar title="Automatizaciones" />
      <p className="screen-subtitle">Prepara, revisa y exporta tus formularios.</p>
      <section className="annuality-brief" aria-label="Pago de anualidades">
        <CreditCard size={24} />
        <div>
          <strong>Pago de anualidades USCIS</strong>
          <span>
            Prepara la Tarifa Anual de Asilo con A-Number, recibo I-589, fecha limite y comprobante interno.
          </span>
        </div>
      </section>
      {activeWorkflow ? (
        <FormWorkflowPanel
          activeWorkflow={activeWorkflow}
          generatedPacketUrl={generatedPacketUrl}
          onGeneratePacket={onGeneratePacket}
          onSaveAnswer={onSaveAnswer}
          packetMessage={packetMessage}
          saving={workflowBusy}
        />
      ) : null}
      <div className="stepper" aria-label="Progreso de formulario">
        {["Preparar", "Revisar", "Firmar", "Exportar"].map((step, index) => (
          <span className={index === 0 ? "active" : ""} key={step}>
            <b>{index + 1}</b>
            {step}
          </span>
        ))}
      </div>

      <section className="section-block">
        <h2>Flujos disponibles</h2>
        <div className="automation-list">
          {loading ? (
            <div className="empty-state">
              <Loader2 className="spin" size={22} />
              <strong>Cargando formularios.</strong>
              <span>Consultando el catalogo oficial.</span>
            </div>
          ) : (
            flows.map((flow) => (
              <AutomationCard
                disabled={workflowBusy}
                flow={flow}
                key={flow.id}
                onStart={() => onStart(formCodeForFlow(flow))}
              />
            ))
          )}
        </div>
      </section>

      <div className="info-callout">
        <ShieldCheck size={24} />
        <div>
          <strong>Automatiza sin perder control.</strong>
          <span>Los casos complejos pasan por revision humana antes de generar el paquete final.</span>
        </div>
      </div>
    </main>
  );
}

function FormWorkflowPanel({
  activeWorkflow,
  generatedPacketUrl,
  onGeneratePacket,
  onSaveAnswer,
  packetMessage,
  saving
}: {
  activeWorkflow: ActiveWorkflow;
  generatedPacketUrl: string | null;
  onGeneratePacket: (sessionId: string) => Promise<void>;
  onSaveAnswer: (sessionId: string, questionKey: string, answer: unknown) => Promise<void>;
  packetMessage: string | null;
  saving: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});

  const saveAnswers = async () => {
    const entries = Object.entries(answers);
    for (const [questionKey, answer] of entries) {
      await onSaveAnswer(activeWorkflow.sessionId, questionKey, answer);
    }
  };

  return (
    <section className="workflow-panel">
      <div className="workflow-panel-heading">
        <div>
          <strong>Sesion {activeWorkflow.formCode}</strong>
          <span>Estado: {activeWorkflow.status.replaceAll("_", " ")}</span>
        </div>
        <span>{activeWorkflow.questions.length} campos</span>
      </div>
      {activeWorkflow.formCode === "ANNUAL_ASYLUM_FEE" ? <AnnualAsylumFeeGuidance /> : null}
      <div className="workflow-fields">
        {activeWorkflow.questions.map((question) => {
          const id = `${activeWorkflow.sessionId}-${question.question_key}`;
          const isBoolean = question.data_type === "boolean";
          const isSelect = question.data_type === "select";
          return (
            <label className={isBoolean ? "workflow-check" : "workflow-field"} htmlFor={id} key={question.question_key}>
              <span>
                {question.label_es}
                {question.required ? " *" : ""}
              </span>
              {isBoolean ? (
                <input
                  checked={Boolean(answers[question.question_key])}
                  id={id}
                  onChange={(event) => {
                    const value = event.target.checked;
                    setAnswers((current) => ({ ...current, [question.question_key]: value }));
                  }}
                  type="checkbox"
                />
              ) : isSelect ? (
                <select
                  id={id}
                  onChange={(event) => {
                    setAnswers((current) => ({ ...current, [question.question_key]: event.target.value }));
                  }}
                  value={String(answers[question.question_key] ?? "")}
                >
                  <option value="">Seleccionar</option>
                  {(question.validation_rule.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label_es}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  onChange={(event) => {
                    setAnswers((current) => ({ ...current, [question.question_key]: event.target.value }));
                  }}
                  placeholder={question.help_text_es ?? ""}
                  type={question.data_type === "date" ? "date" : "text"}
                  value={String(answers[question.question_key] ?? "")}
                />
              )}
            </label>
          );
        })}
      </div>
      <div className="workflow-actions">
        <button
          className="primary-button"
          disabled={saving}
          onClick={() => {
            void saveAnswers();
          }}
        >
          {saving ? <Loader2 className="spin" size={16} /> : <FileCheck2 size={16} />}
          Guardar respuestas
        </button>
        <button
          className="secondary-action"
          disabled={saving}
          onClick={() => {
            void saveAnswers().then(() => onGeneratePacket(activeWorkflow.sessionId));
          }}
        >
          Generar paquete PDF
        </button>
      </div>
      {packetMessage ? <p className="form-success">{packetMessage}</p> : null}
      {generatedPacketUrl ? (
        <a className="packet-link" href={generatedPacketUrl} rel="noreferrer" target="_blank">
          Abrir PDF generado
        </a>
      ) : null}
      <p className="legal-note">
        La app prepara el paquete; el usuario debe revisar y presentar o pagar por el canal oficial.
      </p>
    </section>
  );
}

function AnnualAsylumFeeGuidance() {
  return (
    <div className="official-guidance">
      <CreditCard size={18} />
      <div>
        <strong>Pago real solo en USCIS</strong>
        <span>
          Este flujo organiza la informacion y el comprobante. El pago se completa en el portal oficial con A-Number y
          numero de recibo.
        </span>
        <a href="https://my.uscis.gov/accounts/annual-asylum-fee/start/overview" rel="noreferrer" target="_blank">
          Abrir portal oficial <ChevronRight size={15} />
        </a>
      </div>
    </div>
  );
}

function AutomationCard({ disabled, flow, onStart }: { disabled: boolean; flow: AutomationFlow; onStart: () => void }) {
  const icon =
    flow.filingType === "ANNUAL_ASYLUM_FEE"
      ? CreditCard
      : flow.filingType === "CHANGE_OF_VENUE"
        ? Landmark
        : flow.filingType === "I765_RENEWAL"
          ? FileCheck2
          : MapPin;
  const Icon = icon;

  return (
    <article className="automation-card">
      <div className={`automation-icon ${flow.filingType.toLowerCase()}`}>
        <Icon size={24} />
      </div>
      <div>
        <strong>{flow.title}</strong>
        <p>{flow.description}</p>
        <div className="progress-track">
          <span style={{ width: `${flow.progress}%` }} />
        </div>
      </div>
      <span className="flow-chip">{flow.status.replaceAll("_", " ")}</span>
      <button className="mini-action" disabled={disabled} onClick={onStart}>
        {flow.status === "not_started" ? "Comenzar" : "Abrir"}
      </button>
      <ChevronRight size={18} />
    </article>
  );
}

const fallbackUtahDmvQuestions: DmvPracticeQuestion[] = [
  {
    answerKey: "b",
    choices: [
      { key: "a", label: "35 mph" },
      { key: "b", label: "25 mph" },
      { key: "c", label: "45 mph" }
    ],
    explanation: "El manual de Utah indica 25 mph en areas residenciales o comerciales sin senal.",
    id: "fallback-ut-speed-residential",
    prompt: "Si no hay senal, cual es el limite en una zona residencial o comercial de Utah?",
    topic: "speed"
  },
  {
    answerKey: "a",
    choices: [
      { key: "a", label: "20 mph" },
      { key: "b", label: "30 mph" },
      { key: "c", label: "55 mph" }
    ],
    explanation: "El manual de Utah lista 20 mph al pasar una escuela durante recreo, entrada/salida o luces.",
    id: "fallback-ut-speed-school",
    prompt: "Cual es la velocidad indicada al pasar por una escuela durante entrada, salida o luces intermitentes?",
    topic: "speed"
  },
  {
    answerKey: "c",
    choices: [
      { key: "a", label: "Seguir si no viene nadie" },
      { key: "b", label: "Tocar bocina y avanzar" },
      { key: "c", label: "Detenerse antes de entrar y esperar hasta que sea permitido" }
    ],
    explanation: "Ante luz roja debes detenerte antes de entrar a la interseccion.",
    id: "fallback-ut-red-light",
    prompt: "Que exige una luz roja antes de entrar a una interseccion?",
    topic: "signals"
  },
  {
    answerKey: "b",
    choices: [
      { key: "a", label: "Acelerar para no bloquear" },
      { key: "b", label: "Reducir velocidad y proceder con cautela" },
      { key: "c", label: "Detenerse siempre 10 segundos" }
    ],
    explanation: "Una luz amarilla intermitente requiere reducir velocidad y proceder con cautela.",
    id: "fallback-ut-flashing-yellow",
    prompt: "Que debe hacer ante una luz amarilla intermitente?",
    topic: "signals"
  },
  {
    answerKey: "c",
    choices: [
      { key: "a", label: "Usarlas siempre en ciudad" },
      { key: "b", label: "Apagarlas solo si hay niebla" },
      { key: "c", label: "Bajarlas ante trafico cercano" }
    ],
    explanation: "El manual indica bajar luces altas ante trafico cercano para no encandilar.",
    id: "fallback-ut-high-beams",
    prompt: "Que regla aplica con luces altas cuando hay vehiculos aproximandose?",
    topic: "night-driving"
  }
];

function UtilityHub({ dmvQuestions }: { dmvQuestions: DmvPracticeQuestion[] }) {
  const questions = dmvQuestions.length > 0 ? dmvQuestions : fallbackUtahDmvQuestions;
  const [quizStarted, setQuizStarted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const currentQuestion = questions[Math.min(questionIndex, questions.length - 1)]!;
  const answered = selectedChoice !== null;
  const completed = quizStarted && questionIndex >= questions.length;

  const resetQuiz = () => {
    setQuizStarted(true);
    setQuestionIndex(0);
    setSelectedChoice(null);
    setScore(0);
  };

  const advanceQuiz = () => {
    if (selectedChoice === currentQuestion.answerKey) {
      setScore((current) => current + 1);
    }
    setSelectedChoice(null);
    setQuestionIndex((current) => current + 1);
  };

  return (
    <main className="screen-stack light-screen">
      <TopBar title="Utilidades" />
      <p className="screen-subtitle">Herramientas y recursos para tu camino.</p>
      <section className="dmv-card">
        <div className="steering-wheel">
          <WalletCards size={34} />
        </div>
        <div>
          <strong>Simulador DMV Utah</strong>
          <span>Practica para tu examen escrito con preguntas oficiales.</span>
          <button className="primary-button" onClick={resetQuiz}>
            Comenzar practica <ChevronRight size={16} />
          </button>
        </div>
      </section>

      {quizStarted ? (
        <section className="quiz-panel">
          {completed ? (
            <>
              <div className="quiz-result">
                <strong>
                  Resultado: {score}/{questions.length}
                </strong>
                <span>{score >= 4 ? "Listo para seguir practicando por temas." : "Repasa velocidad, senales y luces."}</span>
              </div>
              <button className="primary-button" onClick={resetQuiz}>
                Repetir practica
              </button>
            </>
          ) : (
            <>
              <div className="quiz-heading">
                <strong>
                  Pregunta {questionIndex + 1}/{questions.length}
                </strong>
                <a href="https://dld.utah.gov/resources/" rel="noreferrer" target="_blank">
                  Manual Utah DLD
                </a>
              </div>
              <p>{currentQuestion.prompt}</p>
              <div className="quiz-options">
                {currentQuestion.choices.map((choice) => {
                  const isCorrect = answered && choice.key === currentQuestion.answerKey;
                  const isWrong = answered && choice.key === selectedChoice && choice.key !== currentQuestion.answerKey;
                  return (
                    <button
                      className={`${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`}
                      disabled={answered}
                      key={choice.key}
                      onClick={() => setSelectedChoice(choice.key)}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
              {answered && currentQuestion.explanation ? (
                <span className="quiz-explanation">{currentQuestion.explanation}</span>
              ) : null}
              {answered ? (
                <button className="primary-button" onClick={advanceQuiz}>
                  {questionIndex === questions.length - 1 ? "Ver resultado" : "Siguiente"}
                </button>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      <section className="tool-grid" aria-label="Herramientas destacadas">
        <ToolButton icon={CalendarDays} label="Fechas clave" />
        <ToolButton icon={Grid2X2} label="Calculadora de dias" />
        <ToolButton icon={CheckSquare} label="Checklist personal" />
        <ToolButton icon={Lock} label="Notas seguras" />
      </section>

      <section className="section-block">
        <h2>Recursos locales . Utah</h2>
        <div className="resource-list">
          {resourceRows.map((row) => (
            <button className="resource-row" key={row.id}>
              <MapPin size={20} />
              <span>
                <strong>{row.label}</strong>
                <small>{row.detail}</small>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      </section>

      <div className="trust-strip">
        <ShieldCheck size={28} />
        <div>
          <strong>Informacion confiable.</strong>
          <span>Comunidad que te respalda.</span>
        </div>
      </div>
    </main>
  );
}

function MorePanel({
  message,
  onRequestService,
  services,
  workflowBusy
}: {
  message: string | null;
  onRequestService: (serviceType: PremiumServiceType) => Promise<void>;
  services: PremiumService[];
  workflowBusy: boolean;
}) {
  const annuality = services.find((service) => service.serviceType === "ANNUALITY_PAYMENT");
  const expert = services.find((service) => service.serviceType === "EXPERT_REVIEW");

  return (
    <main className="screen-stack light-screen">
      <TopBar title="Servicios premium" />
      <section className="premium-panel">
        <Sparkles size={30} />
        <h1>Servicios de prueba</h1>
        <p>Activa solicitudes gratis mientras validamos el flujo completo antes de implementar pagos.</p>
        <button
          className="primary-button"
          disabled={workflowBusy}
          onClick={() => void onRequestService("EXPERT_REVIEW")}
        >
          Solicitar revision <MessageCircle size={16} />
        </button>
      </section>
      {message ? <p className="form-success">{message}</p> : null}

      <section className="section-block">
        <h2>Servicios disponibles</h2>
        <div className="service-list">
          <article className="service-card annuality">
            <div className="service-icon">
              <CreditCard size={24} />
            </div>
            <div>
              <strong>{annuality?.title ?? "Pago de anualidades"}</strong>
              <p>{annuality?.description ?? "Administra pagos anuales, comprobantes y recordatorios de renovacion."}</p>
              <span>Gratis por ahora . comprobante interno</span>
            </div>
            <button
              className="secondary-button"
              disabled={workflowBusy}
              onClick={() => void onRequestService("ANNUALITY_PAYMENT")}
            >
              Activar gratis
            </button>
          </article>

          <article className="service-card">
            <div className="service-icon expert">
              <MessageCircle size={24} />
            </div>
            <div>
              <strong>{expert?.title ?? "Revision experta"}</strong>
              <p>{expert?.description ?? "Un especialista revisa tu caso antes de avanzar con tramites delicados."}</p>
              <span>Gratis durante prueba</span>
            </div>
            <button
              className="secondary-button"
              disabled={workflowBusy}
              onClick={() => void onRequestService("EXPERT_REVIEW")}
            >
              Solicitar gratis
            </button>
          </article>
        </div>
      </section>

      <section className="section-block">
        <h2>Seguimiento especial</h2>
        <div className="timeline">
          <span />
          <div>
            <strong>Consulta inicial</strong>
            <small>Completada</small>
          </div>
          <span />
          <div>
            <strong>Revision documental</strong>
            <small>En progreso</small>
          </div>
          <span />
          <div>
            <strong>Paquete final</strong>
            <small>Pendiente</small>
          </div>
        </div>
      </section>
    </main>
  );
}

function BottomNav({ activeTab, onChange }: { activeTab: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Navegacion principal">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button className={activeTab === tab.id ? "active" : ""} onClick={() => onChange(tab.id)} key={tab.id}>
            <Icon size={19} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function TopBar({ title }: { title: string }) {
  return (
    <div className="top-bar">
      <h1>{title}</h1>
      <div>
        <button className="icon-button light" aria-label="Buscar">
          <Search size={18} />
        </button>
        <button className="icon-button light" aria-label="Menu">
          <Menu size={18} />
        </button>
      </div>
    </div>
  );
}

function IconTile({ severity, kind }: { severity: StatusSeverity; kind: string }) {
  const Icon = kind === "court_hearing" ? CalendarDays : kind === "ead_expiration" ? WalletCards : ShieldCheck;
  return (
    <div className={`icon-tile ${severity}`}>
      <Icon size={22} />
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <article className="metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function ToolButton({ icon: Icon, label }: { icon: typeof CalendarDays; label: string }) {
  return (
    <button className="tool-button">
      <Icon size={24} />
      <span>{label}</span>
    </button>
  );
}
