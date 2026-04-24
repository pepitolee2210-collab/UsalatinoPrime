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
  CA: { officialJudiciaryUrl: 'https://www.courts.ca.gov/', likelyCourtLevel: 'Superior Court — Juvenile Dependency / Probate Guardianship', sijsAgeCeiling: 21 },
  CO: { officialJudiciaryUrl: 'https://www.courts.state.co.us/', likelyCourtLevel: 'District Court — Juvenile / Probate', sijsAgeCeiling: 21 },
  CT: { officialJudiciaryUrl: 'https://www.jud.ct.gov/', likelyCourtLevel: 'Superior Court — Juvenile Matters', sijsAgeCeiling: 21 },
  DE: { officialJudiciaryUrl: 'https://courts.delaware.gov/', likelyCourtLevel: 'Family Court', sijsAgeCeiling: 18 },
  DC: { officialJudiciaryUrl: 'https://www.dccourts.gov/', likelyCourtLevel: 'Superior Court — Family Court', sijsAgeCeiling: 21 },
  FL: { officialJudiciaryUrl: 'https://www.flcourts.gov/', likelyCourtLevel: 'Circuit Court — Juvenile / Family Division', sijsAgeCeiling: 18 },
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
  NY: { officialJudiciaryUrl: 'https://www.nycourts.gov/', likelyCourtLevel: 'Family Court / Surrogate Court (Guardianship)', sijsAgeCeiling: 21 },
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
  TX: { officialJudiciaryUrl: 'https://www.txcourts.gov/', likelyCourtLevel: 'District Court / County Court at Law (Juvenile)', sijsAgeCeiling: 18 },
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
