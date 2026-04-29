/**
 * Hints de sitios oficiales del poder judicial por estado. Se usan como
 * *puntos de partida* para que Claude + web_search investigue la corte
 * juvenil/familiar competente en el ZIP del cliente.
 *
 * NO es fuente de verdad: solo le dice al modelo "busca primero aquí".
 * La fuente de verdad es el resultado del web_search (se cachea en
 * `case_jurisdictions` con las URLs específicas que respaldaron el dato).
 *
 * Estados donde SIJS aplica hasta los 21 años (19 estados + DC) vs donde
 * solo aplica hasta los 18 años — referencia rápida tomada del playbook de
 * visa juvenil. El modelo verifica este dato también durante su research.
 */

import type { UsStateCode } from '@/lib/timezones/us-states'

export interface StateCourtHint {
  /** URL raíz del state judiciary. Preferir dominios .gov. */
  officialJudiciaryUrl: string
  /**
   * Nivel típico de la corte para peticiones SIJS de custodia/tutela.
   * Ayuda al modelo a no confundir family court con probate court.
   */
  likelyCourtLevel: string
  /**
   * Edad hasta la que la corte juvenil retiene jurisdicción para SIJS.
   * Dato crítico — si el menor supera este umbral en ese estado, su caso
   * puede requerir jurisdicción alternativa (probate, family, etc.).
   */
  sijsAgeCeiling: 18 | 21
  /**
   * Reglas SIJS específicas del estado para inyectar al system prompt.
   * Documenta los formularios canónicos que el modelo DEBE encontrar y la
   * URL exacta cuando es estable. Solo definido para los estados con alto
   * volumen / formularios bien establecidos (NY, TX, CA, FL, IL...).
   *
   * El modelo lee este bloque como tabla de hardcoded knowledge: si encuentra
   * el form en la fuente oficial usa esa URL; si no, todavía lo lista como
   * obligatorio en required_forms basándose en este hint.
   */
  sijRules?: string
}

/**
 * Mapeo estado → hints. Cubre los 50 estados + DC. Los URLs fueron tomados
 * del directorio público de National Center for State Courts (ncsc.org) y
 * de uscourts.gov/court-locator.
 */
export const STATE_COURT_HINTS: Record<UsStateCode, StateCourtHint> = {
  AL: { officialJudiciaryUrl: 'https://judicial.alabama.gov/', likelyCourtLevel: 'Juvenile Court (part of District Court / County)', sijsAgeCeiling: 18 },
  AK: { officialJudiciaryUrl: 'https://courts.alaska.gov/', likelyCourtLevel: 'Superior Court — Children in Need of Aid', sijsAgeCeiling: 18 },
  AZ: { officialJudiciaryUrl: 'https://www.azcourts.gov/', likelyCourtLevel: 'Superior Court — Juvenile Division (per county)', sijsAgeCeiling: 18 },
  AR: { officialJudiciaryUrl: 'https://www.arcourts.gov/', likelyCourtLevel: 'Circuit Court — Juvenile Division', sijsAgeCeiling: 18 },
  CA: {
    officialJudiciaryUrl: 'https://www.courts.ca.gov/',
    likelyCourtLevel: 'Superior Court — Juvenile Dependency / Probate Guardianship',
    sijsAgeCeiling: 21,
    sijRules: `### California (CA) — TODOS los condados (Los Angeles, San Diego, Orange, Alameda, Santa Clara, Riverside, etc.)

Investiga vía courts.ca.gov forms catalog. Forms judiciales con código GC-* (probate guardianship), JV-* (juvenile dependency), FL-* (family law).

INTAKE (etapa 1):
- Civil Case Cover Sheet (general). Mandatory en Superior Court.
- Notice of Petition for Guardianship — GC-211. Mandatory.

MERITS (etapa 2 — ruta probate guardianship, la más usada para SIJS):
- Petition for Appointment of Guardian of Minor — GC-210 + GC-210(P). Mandatory.
- Confidential Guardian Screening Form — GC-212. Mandatory.
- Duties of Guardian — GC-248.
- Order Appointing Guardian of Minor — GC-240. Mandatory (proposed order del nombramiento).
- Letters of Guardianship — GC-250.

SIJS findings (en CA se piden via motion separado):
- Request for SIJ Findings (formato local del condado, basado en el ILRC template). Mandatory.
- Findings and Order Regarding Special Immigrant Juvenile Status. Mandatory. Algunos condados publican plantillas; cuando no hay, el abogado redacta basándose en INA §1101(a)(27)(J).
- Declaration in Support of Request for SIJ Findings (declaración del menor + del peticionario). Mandatory.

NUNCA omitas el "Findings and Order Regarding SIJ Status" para CA — sin esto USCIS rechaza el I-360.`,
  },
  CO: { officialJudiciaryUrl: 'https://www.courts.state.co.us/', likelyCourtLevel: 'District Court — Juvenile / Probate', sijsAgeCeiling: 21 },
  CT: { officialJudiciaryUrl: 'https://www.jud.ct.gov/', likelyCourtLevel: 'Superior Court — Juvenile Matters', sijsAgeCeiling: 21 },
  DE: { officialJudiciaryUrl: 'https://courts.delaware.gov/', likelyCourtLevel: 'Family Court', sijsAgeCeiling: 18 },
  DC: { officialJudiciaryUrl: 'https://www.dccourts.gov/', likelyCourtLevel: 'Superior Court — Family Court', sijsAgeCeiling: 21 },
  FL: {
    officialJudiciaryUrl: 'https://www.flcourts.gov/',
    likelyCourtLevel: 'Circuit Court — Juvenile / Family Division',
    sijsAgeCeiling: 18,
    sijRules: `### Florida (FL) — TODOS los condados (Miami-Dade, Broward, Orange, Hillsborough, etc.)

Forms estatales en flcourts.gov/Resources-Services/Court-Improvement/Family-Courts/Family-Law-Forms.

INTAKE (etapa 1):
- Civil Cover Sheet — Form 1.997 (CIVIL). Mandatory en Circuit Court.

MERITS (etapa 2):
- Petition for Permanent Guardianship — Form 12.961 (Permanent Guardianship of Minor). Mandatory — slug \`fl-permanent-guardianship\`.
- Petition Determination of Dependency — para casos de dependencia juvenil.
- Order Appointing Permanent Guardian. Mandatory (proposed order).
- Motion for SIJ Findings (no hay template estatal oficial; el abogado redacta basándose en INA §1101(a)(27)(J)). Mandatory.
- Order on Petition for Special Immigrant Juvenile Status (Findings Order). Mandatory. Sin esta orden, USCIS rechaza.
- Affidavit/Declaration of [petitioner / minor] in Support of SIJ Findings. Mandatory.

NUNCA omitas el "Order on Petition for Special Immigrant Juvenile Status" para FL.`,
  },
  GA: { officialJudiciaryUrl: 'https://georgiacourts.gov/', likelyCourtLevel: 'Juvenile Court (per county)', sijsAgeCeiling: 18 },
  HI: { officialJudiciaryUrl: 'https://www.courts.state.hi.us/', likelyCourtLevel: 'Family Court — Circuit Court', sijsAgeCeiling: 21 },
  ID: { officialJudiciaryUrl: 'https://isc.idaho.gov/', likelyCourtLevel: 'Magistrate Court — Juvenile / CPA', sijsAgeCeiling: 18 },
  IL: { officialJudiciaryUrl: 'https://www.illinoiscourts.gov/', likelyCourtLevel: 'Circuit Court — Juvenile Division', sijsAgeCeiling: 21 },
  IN: { officialJudiciaryUrl: 'https://www.in.gov/courts/', likelyCourtLevel: 'Circuit / Superior / Probate Court — Juvenile', sijsAgeCeiling: 18 },
  IA: { officialJudiciaryUrl: 'https://www.iowacourts.gov/', likelyCourtLevel: 'District Court — Juvenile / Family', sijsAgeCeiling: 18 },
  KS: { officialJudiciaryUrl: 'https://www.kscourts.org/', likelyCourtLevel: 'District Court — Juvenile Division', sijsAgeCeiling: 18 },
  KY: { officialJudiciaryUrl: 'https://kycourts.gov/', likelyCourtLevel: 'Family Court / District Court', sijsAgeCeiling: 18 },
  LA: { officialJudiciaryUrl: 'https://www.lasc.org/', likelyCourtLevel: 'Juvenile Court / Family Court / District Court', sijsAgeCeiling: 18 },
  ME: { officialJudiciaryUrl: 'https://www.courts.maine.gov/', likelyCourtLevel: 'District Court — Family / Child Protective', sijsAgeCeiling: 21 },
  MD: { officialJudiciaryUrl: 'https://mdcourts.gov/', likelyCourtLevel: 'Circuit Court — Juvenile / Equity (Guardianship)', sijsAgeCeiling: 21 },
  MA: { officialJudiciaryUrl: 'https://www.mass.gov/orgs/massachusetts-court-system', likelyCourtLevel: 'Juvenile Court / Probate and Family Court', sijsAgeCeiling: 21 },
  MI: { officialJudiciaryUrl: 'https://www.courts.michigan.gov/', likelyCourtLevel: 'Circuit Court — Family Division (Juvenile)', sijsAgeCeiling: 18 },
  MN: { officialJudiciaryUrl: 'https://www.mncourts.gov/', likelyCourtLevel: 'District Court — Juvenile / Probate', sijsAgeCeiling: 21 },
  MS: { officialJudiciaryUrl: 'https://courts.ms.gov/', likelyCourtLevel: 'Chancery Court / Youth Court', sijsAgeCeiling: 21 },
  MO: { officialJudiciaryUrl: 'https://www.courts.mo.gov/', likelyCourtLevel: 'Circuit Court — Juvenile Division', sijsAgeCeiling: 18 },
  MT: { officialJudiciaryUrl: 'https://courts.mt.gov/', likelyCourtLevel: 'District Court / Youth Court', sijsAgeCeiling: 18 },
  NE: { officialJudiciaryUrl: 'https://supremecourt.nebraska.gov/', likelyCourtLevel: 'Separate Juvenile Court / County Court', sijsAgeCeiling: 18 },
  NV: { officialJudiciaryUrl: 'https://nvcourts.gov/', likelyCourtLevel: 'District Court — Family / Juvenile Division', sijsAgeCeiling: 21 },
  NH: { officialJudiciaryUrl: 'https://www.courts.nh.gov/', likelyCourtLevel: 'Circuit Court — Family Division', sijsAgeCeiling: 18 },
  NJ: { officialJudiciaryUrl: 'https://www.njcourts.gov/', likelyCourtLevel: 'Superior Court — Chancery Division, Family Part', sijsAgeCeiling: 21 },
  NM: { officialJudiciaryUrl: 'https://www.nmcourts.gov/', likelyCourtLevel: "Children's Court / District Court", sijsAgeCeiling: 21 },
  NY: {
    officialJudiciaryUrl: 'https://www.nycourts.gov/',
    likelyCourtLevel: 'Family Court / Surrogate Court (Guardianship)',
    sijsAgeCeiling: 21,
    sijRules: `### New York (NY) — TODOS los condados (Kings/Brooklyn, Bronx, Queens, Manhattan, Nassau, Suffolk, Westchester, Rockland, etc.)

Formularios SIJS Fase 1 que SIEMPRE debes incluir en required_forms / intake_packet.required_forms:

INTAKE (etapa 1):
- Form 6-1 funciona como commencement document (no hay coversheet civil separado en NY Family Court). El clerk del Petition Room asigna docket number sobre la propia 6-1. Marca esto en intake_packet.notes y NO marques intake_coversheet como faltante.
- En NYC (Kings, Bronx, Queens, NY County): el Petition Room/Clerk acepta la petición directamente.
- En condados fuera de NYC (Nassau, Suffolk, Westchester) puede haber un Identification Sheet o NCFC Information Sheet local — investígalo.
- OCFS-3909 — Request for Information Guardianship Form (background check del tutor propuesto bajo SCPA §1706(2)). Es OBLIGATORIO en intake. URL: \`https://ocfs.ny.gov/main/Forms/cps/OCFS-3909_Request-for-Information-Guardianship-Form_For-Court-Use-Only.dotx\`

MERITS (etapa 2):
- Form 6-1 — Petition for Appointment as Guardian of a Person or Permanent Guardian (FCA §661; SCPA §§1701-1704). URL: \`https://www.nycourts.gov/LegacyPDFS/FORMS/familycourt/pdfs/6-1.pdf\` — slug \`null\` (aún no automatizada).
- Form 6-2 — Affirmation and Designation for Service of Process (Guardianship Oath del tutor). Mandatory.
- Form 6-3 — Consent of Person Over 18 / Preference of Person Over 14 Regarding Appointment of Guardian. Obligatorio si el menor tiene 14+ años.
- Form 6-4 — Waiver of Process, Renunciation or Consent to Guardianship. Opcional, solo cuando los padres consienten.
- Form 6-5 — Order Appointing Guardian of the Person or Permanent Guardian (proposed order del nombramiento). Mandatory.
- Form GF-42 — Special Findings Order (SIJS template OCA, Administrative Order 394). URL: \`https://www.nycourts.gov/LegacyPDFS/FORMS/familycourt/pdfs/gf-42.pdf\`. **OBLIGATORIA. Sin esta orden, USCIS rechaza el I-360.** Si la fuente directa devuelve 403, cita el .docx: \`https://www.nycourts.gov/LegacyPDFS/FORMS/familycourt/pdfs/gf-42.docx\`.
- Notice of Motion for Special Findings (SIJS) — sample template del NY AFC CLE. URL: \`https://ad4.nycourts.gov/afc/cle/course/4145\`. Mandatory.
- Affirmation/Affidavit in Support of Motion for Order of Special Findings — sample del mismo CLE. Mandatory. Documenta abuso/negligencia/abandono y el mejor interés del menor.
- Memorandum of Law in Support of Motion for Special Findings — sample del CLE. Recomendado (no obligatorio).
- Form 21 (GF-21) — Address Confidentiality (FCA §154-b). Opcional, solo si revelar el domicilio supone riesgo de salud/seguridad. URL: \`https://www.nycourts.gov/LegacyPDFS/FORMS/familycourt/pdfs/gf-21.pdf\`.

Filing channel: in_person en el Petition Room del condado correspondiente. Algunos abogados usan NYSCEF (consensual e-filing) — si aplica, agrega EF-FAM-1 Notice of Electronic Filing como opcional.

Fee: $0 (NY Family Court NO cobra arancel de radicación para guardianship).

NUNCA omitas GF-42 para casos NY. Si tu primera búsqueda no la encontró, busca explícitamente: \`"GF-42" "Special Findings" site:nycourts.gov\`.`,
  },
  NC: { officialJudiciaryUrl: 'https://www.nccourts.gov/', likelyCourtLevel: 'District Court — Juvenile / Civil (Custody)', sijsAgeCeiling: 18 },
  ND: { officialJudiciaryUrl: 'https://www.ndcourts.gov/', likelyCourtLevel: 'Juvenile Court (District Court)', sijsAgeCeiling: 18 },
  OH: { officialJudiciaryUrl: 'https://www.supremecourt.ohio.gov/', likelyCourtLevel: 'Juvenile Court / Probate Court (per county)', sijsAgeCeiling: 18 },
  OK: { officialJudiciaryUrl: 'https://www.oscn.net/', likelyCourtLevel: 'District Court — Juvenile / Family', sijsAgeCeiling: 18 },
  OR: { officialJudiciaryUrl: 'https://www.courts.oregon.gov/', likelyCourtLevel: 'Circuit Court — Juvenile / Probate', sijsAgeCeiling: 21 },
  PA: { officialJudiciaryUrl: 'https://www.pacourts.us/', likelyCourtLevel: 'Court of Common Pleas — Orphans / Family', sijsAgeCeiling: 18 },
  RI: { officialJudiciaryUrl: 'https://www.courts.ri.gov/', likelyCourtLevel: 'Family Court', sijsAgeCeiling: 21 },
  SC: { officialJudiciaryUrl: 'https://www.sccourts.org/', likelyCourtLevel: 'Family Court', sijsAgeCeiling: 18 },
  SD: { officialJudiciaryUrl: 'https://ujs.sd.gov/', likelyCourtLevel: 'Circuit Court — Juvenile Division', sijsAgeCeiling: 18 },
  TN: { officialJudiciaryUrl: 'https://www.tncourts.gov/', likelyCourtLevel: 'Juvenile Court / Chancery Court', sijsAgeCeiling: 18 },
  TX: {
    officialJudiciaryUrl: 'https://www.txcourts.gov/',
    likelyCourtLevel: 'District Court / County Court at Law (Juvenile)',
    sijsAgeCeiling: 18,
    sijRules: `### Texas (TX) — TODOS los condados (Harris, Dallas, Bexar, Travis, Tarrant, El Paso, etc.)

Usa SIEMPRE TexasLawHelp.org y dfps.texas.gov para forms estatales — los packets de un solo condado NO aplican a otros.

INTAKE (etapa 1):
- Civil Case Information Sheet — PR-GEN-116. URL: \`https://texaslawhelp.org/sites/default/files/pr-gen-116_civil_case_information_sheet.pdf\` — slug \`tx-pr-gen-116\`.
- Statement of Inability to Afford Payment — CB-CFFW-100 (fee waiver, opcional).

MERITS (etapa 2):
- Original Petition in SAPCR — FM-SAPCR-100 (Rev. 09-2025). URL: \`https://texaslawhelp.org/sites/default/files/2025-09/fm-sapcr-100_sapcr_petition_2025_legis_update.pdf\` — slug \`tx-fm-sapcr-100\`.
- Affidavit for Standing of Nonparent — FM-SAPCR-AFF-100 (OBLIGATORIO desde 09-01-2025 bajo TFC §102.0031 si el peticionario no es padre biológico). URL: \`https://texaslawhelp.org/sites/default/files/2025-09/fm-sapcr-aff-100_affidavit_for_standing_of_nonparent_2025.pdf\` — slug \`tx-fm-sapcr-aff-100\`.
- Order in SAPCR Nonparent Custody — FM-SAPCR-205. URL: \`https://texaslawhelp.org/sites/default/files/2024-03/fm-sapcr-205_sapcr_nonparent_order_english_2024.pdf\` — slug \`tx-fm-sapcr-205\`.
- DFPS Section 13 Tools (OBLIGATORIOS para SIJS — son los templates oficiales del Texas DFPS Attorneys Guide):
  - Motion for Findings Regarding SIJ Status: \`https://www.dfps.texas.gov/Child_Protection/Attorneys_Guide/documents/Section_13_Tools/Citizenship_and_Immigration/Motion_for_Findings_Regarding_SIJ_Status.docx\` — slug \`tx-dfps-sij-findings-motion\`.
  - Order Regarding SIJS Findings: \`https://www.dfps.texas.gov/Child_Protection/Attorneys_Guide/documents/Section_13_Tools/Citizenship_and_Immigration/2019_Order_SIJ_Findings.docx\` — slug \`tx-dfps-sij-findings-order\`.
  - Affidavit to Support SIJ Motion: \`https://www.dfps.texas.gov/Child_Protection/Attorneys_Guide/documents/Section_13_Tools/Citizenship_and_Immigration/2019_Affidavit_to_Support_SIJ_Motion.doc\` — slug \`tx-dfps-sij-affidavit\`.
- Certificate of Conference (Harris County local rule) — sin URL estable, documenta en notes.

Filing channel: e-filing obligatorio para abogados vía eFileTexas.gov.

NUNCA omitas los 3 DFPS Section 13 Tools (Motion + Order + Affidavit). Son la base SIJS en Texas.`,
  },
  UT: { officialJudiciaryUrl: 'https://www.utcourts.gov/', likelyCourtLevel: 'Juvenile Court (District-based)', sijsAgeCeiling: 21 },
  VT: { officialJudiciaryUrl: 'https://www.vermontjudiciary.org/', likelyCourtLevel: 'Family Division — Superior Court', sijsAgeCeiling: 21 },
  VA: { officialJudiciaryUrl: 'https://www.vacourts.gov/', likelyCourtLevel: 'Juvenile and Domestic Relations District Court', sijsAgeCeiling: 18 },
  WA: { officialJudiciaryUrl: 'https://www.courts.wa.gov/', likelyCourtLevel: 'Superior Court — Juvenile Division', sijsAgeCeiling: 21 },
  WV: { officialJudiciaryUrl: 'https://www.courtswv.gov/', likelyCourtLevel: 'Family Court / Circuit Court', sijsAgeCeiling: 18 },
  WI: { officialJudiciaryUrl: 'https://www.wicourts.gov/', likelyCourtLevel: 'Circuit Court — Juvenile Division', sijsAgeCeiling: 18 },
  WY: { officialJudiciaryUrl: 'https://www.courts.state.wy.us/', likelyCourtLevel: 'District Court — Juvenile', sijsAgeCeiling: 18 },
}

export function getStateCourtHint(code: UsStateCode): StateCourtHint {
  return STATE_COURT_HINTS[code]
}
