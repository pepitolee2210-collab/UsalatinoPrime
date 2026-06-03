// Catálogo curado de Cortes de Inmigración (EOIR) y su Office of the Principal
// Legal Advisor (OPLA / "Chief Counsel" / Fiscal Principal) correspondiente.
//
// FUENTE AUTORITATIVA: handout oficial de ICE "Addresses for Immigration Court &
// ICE Attorneys" (dockets NON-DETAINED + DETAINED), cruzado con la lista de
// control administrativo de EOIR (justice.gov/eoir) y validado contra los OPLA
// que ya aparecían en datos reales de producción (cambio_corte_submissions).
//
// USO: este catálogo NO se imprime tal cual. Se serializa como CONTEXTO para
// Claude en `suggest-court.ts`, que razona geográficamente qué corte corresponde
// a la nueva dirección del cliente y devuelve la sugerencia. El staff SIEMPRE la
// revisa antes de generar el PDF. Las direcciones EOIR/OPLA cambian: re-validar
// periódicamente contra justice.gov/eoir e ice.gov.
//
// `chiefCounselAddress` viene listo para usarse en el campo multilínea de la
// carta (líneas separadas por \n): nombre de la oficina + calle + ciudad/estado/ZIP.

export interface EoirCourt {
  /** Clave estable. Coincide con el value del dropdown del EOIR-33 cuando aplica. */
  key: string
  /** Nombre de la corte para `new_court_name` (ej. "Salt Lake City Immigration Court"). */
  name: string
  city: string
  /** Código de estado de 2 letras (o territorio: PR, MP). */
  state: string
  /** Dirección de la corte (calle) → `new_court_street`. */
  courtStreet: string
  /** Ciudad, Estado ZIP de la corte → `new_court_city_state_zip`. */
  courtCityStateZip: string
  /** Bloque OPLA/Chief Counsel multilínea → `new_court_chief_counsel_address`. */
  chiefCounselAddress: string
  /** true cuando la corte solo opera docket de detenidos (menos probable para un traslado voluntario). */
  detainedOnly?: boolean
  /** Nota de cautela si el dato oficial es ambiguo o conviene verificar. */
  note?: string
}

export const EOIR_COURTS: EoirCourt[] = [
  // ── NON-DETAINED ────────────────────────────────────────────────
  {
    key: 'Annandale', name: 'Annandale Immigration Court', city: 'Annandale', state: 'VA',
    courtStreet: '7619 Little River Turnpike, Suite 400', courtCityStateZip: 'Annandale, VA 22003',
    chiefCounselAddress: 'OPLA Annandale\n500 12th Street SW, Mail Stop 5902\nWashington, D.C. 20536-5902',
  },
  {
    key: 'Atlanta - Ted Turner Drive', name: 'Atlanta (Ted Turner Drive) Immigration Court', city: 'Atlanta', state: 'GA',
    courtStreet: '180 Ted Turner Drive, SW, Suite 241', courtCityStateZip: 'Atlanta, GA 30303',
    chiefCounselAddress: 'OPLA Atlanta (Ted Turner Drive)\n180 Ted Turner Drive, SW, Suite 332\nAtlanta, GA 30303',
  },
  {
    key: 'Atlanta - W. Peachtree Street', name: 'Atlanta (W. Peachtree Street) Immigration Court', city: 'Atlanta', state: 'GA',
    courtStreet: 'Peachtree Summit Federal Building, 401 W. Peachtree Street, Suite 2600', courtCityStateZip: 'Atlanta, GA 30308',
    chiefCounselAddress: 'OPLA Atlanta (Peachtree St)\n401 W. Peachtree Street, NW, Suite 2850\nAtlanta, GA 30308',
  },
  {
    key: 'Baltimore', name: 'Baltimore Immigration Court', city: 'Baltimore', state: 'MD',
    courtStreet: 'George Fallon Federal Building, 31 Hopkins Plaza, Rm. 440', courtCityStateZip: 'Baltimore, MD 21201',
    chiefCounselAddress: 'OPLA Baltimore\nFallon Federal Building, 31 Hopkins Plaza, Room 1600\nBaltimore, MD 21201',
  },
  {
    key: 'Boston', name: 'Boston Immigration Court', city: 'Boston', state: 'MA',
    courtStreet: 'JFK Federal Building, 15 New Sudbury Street, Room 320', courtCityStateZip: 'Boston, MA 02203',
    chiefCounselAddress: 'OPLA Boston\nJFK Federal Building, 15 New Sudbury Street, Room 425\nBoston, MA 02203',
  },
  {
    key: 'Buffalo', name: 'Buffalo Immigration Court', city: 'Buffalo', state: 'NY',
    courtStreet: '130 Delaware Avenue, Suite 300', courtCityStateZip: 'Buffalo, NY 14202',
    chiefCounselAddress: 'OPLA Buffalo\n250 Delaware Avenue, Suite 773\nBuffalo, NY 14202',
  },
  {
    key: 'Charlotte', name: 'Charlotte Immigration Court', city: 'Charlotte', state: 'NC',
    courtStreet: '5701 Executive Center Drive, Suite 400', courtCityStateZip: 'Charlotte, NC 28212',
    chiefCounselAddress: 'OPLA Charlotte\n701 Executive Center Drive, Suite 300\nCharlotte, NC 28212',
  },
  {
    key: 'Chelmsford', name: 'Chelmsford Immigration Court', city: 'Chelmsford', state: 'MA',
    courtStreet: '150 Apollo Drive, Suite 100', courtCityStateZip: 'Chelmsford, MA 01824',
    chiefCounselAddress: 'OPLA Boston\nJFK Federal Building, 15 New Sudbury Street, Room 425\nBoston, MA 02203',
  },
  {
    key: 'Chicago', name: 'Chicago Immigration Court', city: 'Chicago', state: 'IL',
    courtStreet: '55 E. Monroe St., Suite 1500', courtCityStateZip: 'Chicago, IL 60603',
    chiefCounselAddress: 'OPLA Chicago\n55 E. Monroe Street, Suite 1400\nChicago, IL 60603',
  },
  {
    key: 'Cleveland', name: 'Cleveland Immigration Court', city: 'Cleveland', state: 'OH',
    courtStreet: '801 W. Superior Avenue, Suite 13-100', courtCityStateZip: 'Cleveland, OH 44113',
    chiefCounselAddress: 'OPLA Brooklyn Heights\n925 Keynote Circle, Room 201\nBrooklyn Heights, OH 44131',
  },
  {
    key: 'Concord', name: 'Concord Immigration Court', city: 'Concord', state: 'CA',
    courtStreet: '1855 Gateway Boulevard, Ste 850', courtCityStateZip: 'Concord, CA 94520',
    chiefCounselAddress: 'OPLA Concord\n100 Montgomery Street, Suite 200\nSan Francisco, CA 94104',
  },
  {
    key: 'Dallas', name: 'Dallas Immigration Court', city: 'Dallas', state: 'TX',
    courtStreet: '1100 Commerce Street, Suite 1060', courtCityStateZip: 'Dallas, TX 75242',
    chiefCounselAddress: 'OPLA Dallas\n125 East John Carpenter Fwy., Ste. 500\nIrving, TX 75062',
  },
  {
    key: 'Denver', name: 'Denver Immigration Court', city: 'Denver', state: 'CO',
    courtStreet: '1961 Stout Street, Suite 3101', courtCityStateZip: 'Denver, CO 80294',
    chiefCounselAddress: 'OPLA Centennial\n12445 East Caley Avenue\nCentennial, CO 80111-6432',
  },
  {
    key: 'Detroit', name: 'Detroit Immigration Court', city: 'Detroit', state: 'MI',
    courtStreet: '477 Michigan Avenue, Suite 440', courtCityStateZip: 'Detroit, MI 48226',
    chiefCounselAddress: 'OPLA Detroit\nRosa Parks Federal Building, 985 Michigan Avenue, Suite 1010\nDetroit, MI 48226',
  },
  {
    key: 'El Paso', name: 'El Paso Immigration Court', city: 'El Paso', state: 'TX',
    courtStreet: '700 E. San Antonio Avenue, Suite 750', courtCityStateZip: 'El Paso, TX 79901',
    chiefCounselAddress: 'OPLA El Paso\n11541 Montana Avenue, Suite O\nEl Paso, TX 79936',
  },
  {
    key: 'Fort Snelling', name: 'Fort Snelling Immigration Court', city: 'Fort Snelling', state: 'MN',
    courtStreet: 'Bishop Henry Whipple Federal Building, 1 Federal Drive, Suite 1850', courtCityStateZip: 'Fort Snelling, MN 55111',
    chiefCounselAddress: 'OPLA Fort Snelling\n1 Federal Drive, Suite 1800\nFort Snelling, MN 55111',
  },
  {
    key: 'Guaynabo (San Juan)', name: 'Guaynabo (San Juan) Immigration Court', city: 'Guaynabo', state: 'PR',
    courtStreet: 'San Patricio Office Center, #7 Tabonuco Street, Room 401', courtCityStateZip: 'Guaynabo, PR 00968-4605',
    chiefCounselAddress: 'OPLA Guaynabo\n7 Tabonuco Street, Room 300 (Ste. 313)\nGuaynabo, PR 00968',
  },
  {
    key: 'Harlingen', name: 'Harlingen Immigration Court', city: 'Harlingen', state: 'TX',
    courtStreet: '2009 West Jefferson Avenue, Suite 300', courtCityStateZip: 'Harlingen, TX 78550',
    chiefCounselAddress: 'OPLA Harlingen\n1717 Zoy Street, Annex\nHarlingen, TX 78552',
  },
  {
    key: 'Hartford', name: 'Hartford Immigration Court', city: 'Hartford', state: 'CT',
    courtStreet: 'AA Ribicoff Federal Building, 450 Main Street, Suite 628', courtCityStateZip: 'Hartford, CT 06103-3015',
    chiefCounselAddress: 'OPLA Hartford\nRibicoff Federal Building, 450 Main Street, Room 483\nHartford, CT 06103-3060',
  },
  {
    key: 'Honolulu', name: 'Honolulu Immigration Court', city: 'Honolulu', state: 'HI',
    courtStreet: 'PJKK Federal Building, 300 Ala Moana Blvd., Rm. 8-112', courtCityStateZip: 'Honolulu, HI 96850',
    chiefCounselAddress: 'OPLA Honolulu\n300 Ala Moana Boulevard, Suite 7-220\nHonolulu, HI 96850',
  },
  {
    key: 'Houston - Greenspoint Park', name: 'Houston (Greenspoint Park) Immigration Court', city: 'Houston', state: 'TX',
    courtStreet: '16800 Greenspoint Park Drive, 2nd Floor', courtCityStateZip: 'Houston, TX 77060',
    chiefCounselAddress: 'OPLA Houston\n126 Northpoint Drive, Room 2020\nHouston, TX 77060',
  },
  {
    key: 'Houston - S. Gessner Road', name: 'Houston (S. Gessner Road) Immigration Court', city: 'Houston', state: 'TX',
    courtStreet: '8701 S. Gessner Road, 10th Floor', courtCityStateZip: 'Houston, TX 77074',
    chiefCounselAddress: 'OPLA Houston\n126 Northpoint Drive, Room 2020\nHouston, TX 77060',
  },
  {
    key: 'Hyattsville', name: 'Hyattsville Immigration Court', city: 'Hyattsville', state: 'MD',
    courtStreet: '3311 Toledo Road, Suite 105', courtCityStateZip: 'Hyattsville, MD 20782',
    chiefCounselAddress: 'OPLA Baltimore\nFallon Federal Building, 31 Hopkins Plaza, Room 1600\nBaltimore, MD 21201',
  },
  {
    key: 'Indianapolis', name: 'Indianapolis Immigration Court', city: 'Indianapolis', state: 'IN',
    courtStreet: '950 N. Meridian Street, Suite 185', courtCityStateZip: 'Indianapolis, IN 46204',
    chiefCounselAddress: 'OPLA Chicago\n55 E. Monroe Street, Suite 1400\nChicago, IL 60603',
    note: 'Corte servida administrativamente vía Chicago. Verificar OPLA vigente con la corte.',
  },
  {
    key: 'Kansas City', name: 'Kansas City Immigration Court', city: 'Kansas City', state: 'MO',
    courtStreet: '2345 Grand Boulevard, Suite 525', courtCityStateZip: 'Kansas City, MO 64108',
    chiefCounselAddress: 'OPLA Kansas City\n2345 Grand Boulevard, Suite 500\nKansas City, MO 64108',
  },
  {
    key: 'Laredo', name: 'Laredo Immigration Court', city: 'Laredo', state: 'TX',
    courtStreet: '1406 Jacaman Road, Suite B', courtCityStateZip: 'Laredo, TX 78041',
    chiefCounselAddress: 'OPLA Laredo\n1406 Jacaman Road, Suite C\nLaredo, TX 78041',
  },
  {
    key: 'Las Vegas', name: 'Las Vegas Immigration Court', city: 'Las Vegas', state: 'NV',
    courtStreet: '110 North City Parkway, Suite 400', courtCityStateZip: 'Las Vegas, NV 89106',
    chiefCounselAddress: 'OPLA Las Vegas\n501 S. Las Vegas Blvd, Suite 200\nLas Vegas, NV 89101',
  },
  {
    key: 'Los Angeles - West Los Angeles', name: 'Los Angeles (West Los Angeles) Immigration Court', city: 'Los Angeles', state: 'CA',
    courtStreet: '5245 Pacific Concourse Drive', courtCityStateZip: 'Los Angeles, CA 90045',
    chiefCounselAddress: 'OPLA Los Angeles (Olive St.)\n606 S. Olive Street, 8th Floor\nLos Angeles, CA 90014',
  },
  {
    key: 'Los Angeles - N. Los Angeles Street', name: 'Los Angeles (N. Los Angeles Street) Immigration Court', city: 'Los Angeles', state: 'CA',
    courtStreet: '300 North Los Angeles Street, Room 4330', courtCityStateZip: 'Los Angeles, CA 90012',
    chiefCounselAddress: 'OPLA Los Angeles (N. Los Angeles St.)\n300 N. Los Angeles Street, Suite 1240\nLos Angeles, CA 90012',
  },
  {
    key: 'Los Angeles - Van Nuys Boulevard', name: 'Los Angeles (Van Nuys Boulevard) Immigration Court', city: 'Van Nuys', state: 'CA',
    courtStreet: '6230 Van Nuys Blvd., 3rd Floor, Suite 300', courtCityStateZip: 'Van Nuys, CA 91401',
    chiefCounselAddress: 'OPLA Los Angeles (Van Nuys)\n6230 Van Nuys Boulevard, Suite 1011\nVan Nuys, CA 91401',
  },
  {
    key: 'Memphis', name: 'Memphis Immigration Court', city: 'Memphis', state: 'TN',
    courtStreet: '80 Monroe Avenue, Lower Level Suite G-10', courtCityStateZip: 'Memphis, TN 38103',
    chiefCounselAddress: 'OPLA Memphis\n80 Monroe Avenue, Suite 200\nMemphis, TN 38103',
  },
  {
    key: 'Miami', name: 'Miami Immigration Court', city: 'Miami', state: 'FL',
    courtStreet: 'One Riverview Square, 333 S. Miami Avenue, Suite 700', courtCityStateZip: 'Miami, FL 33130',
    chiefCounselAddress: 'OPLA Miami\n333 S. Miami Avenue, Suite 200\nMiami, FL 33130',
    note: 'Verificar suite/edificio del OPLA Miami con la corte (el handout de ICE lista una dirección de PR por error).',
  },
  {
    key: 'New Orleans', name: 'New Orleans Immigration Court', city: 'New Orleans', state: 'LA',
    courtStreet: 'One Canal Place, 365 Canal Street, Suite 500', courtCityStateZip: 'New Orleans, LA 70130',
    chiefCounselAddress: 'OPLA New Orleans\n1250 Poydras Street, Suite 2100\nNew Orleans, LA 70113',
  },
  {
    key: 'New York - Broadway', name: 'New York (Broadway) Immigration Court', city: 'New York', state: 'NY',
    courtStreet: 'Ted Weiss Federal Building, 290 Broadway, 15th Floor', courtCityStateZip: 'New York, NY 10007',
    chiefCounselAddress: 'OPLA New York (290 Broadway)\n26 Federal Plaza, Room 1130\nNew York, NY 10278',
  },
  {
    key: 'New York - Federal Plaza', name: 'New York (Federal Plaza) Immigration Court', city: 'New York', state: 'NY',
    courtStreet: '26 Federal Plaza, 12th Floor, Room 1237', courtCityStateZip: 'New York, NY 10278',
    chiefCounselAddress: 'OPLA New York (Federal Plaza)\n26 Federal Plaza, Room 1130\nNew York, NY 10278',
  },
  {
    key: 'New York - Varick', name: 'New York (Varick) Immigration Court', city: 'New York', state: 'NY',
    courtStreet: '201 Varick Street, 5th Floor Room 507', courtCityStateZip: 'New York, NY 10014',
    chiefCounselAddress: 'OPLA New York (Varick)\n201 Varick Street, Room 738\nNew York, NY 10014',
  },
  {
    key: 'Newark', name: 'Newark Immigration Court', city: 'Newark', state: 'NJ',
    courtStreet: '970 Broad Street, Room 1200', courtCityStateZip: 'Newark, NJ 07102',
    chiefCounselAddress: 'OPLA Newark\n970 Broad Street, Room 1300\nNewark, NJ 07102',
  },
  {
    key: 'Oakdale', name: 'Oakdale Immigration Court', city: 'Oakdale', state: 'LA',
    courtStreet: '1900 E. Whatley Road', courtCityStateZip: 'Oakdale, LA 71463',
    chiefCounselAddress: 'OPLA Oakdale\n1010 E. Whatley Road\nOakdale, LA 71463-1128',
  },
  {
    key: 'Omaha', name: 'Omaha Immigration Court', city: 'Omaha', state: 'NE',
    courtStreet: '1717 Avenue H, Suite 100', courtCityStateZip: 'Omaha, NE 68110',
    chiefCounselAddress: 'OPLA Omaha\n1717 Avenue H, Room 174\nOmaha, NE 68110',
  },
  {
    key: 'Orlando', name: 'Orlando Immigration Court', city: 'Orlando', state: 'FL',
    courtStreet: '500 N. Orange Ave, Suite 1100', courtCityStateZip: 'Orlando, FL 32801',
    chiefCounselAddress: 'OPLA Orlando\n500 North Orange Avenue, Suite 500\nOrlando, FL 32801',
  },
  {
    key: 'Philadelphia', name: 'Philadelphia Immigration Court', city: 'Philadelphia', state: 'PA',
    courtStreet: 'Robert Nix Federal Bldg, 900 Market Street, Suite 504', courtCityStateZip: 'Philadelphia, PA 19107',
    chiefCounselAddress: 'OPLA Philadelphia\n900 Market Street, Suite 346\nPhiladelphia, PA 19107',
  },
  {
    key: 'Phoenix', name: 'Phoenix Immigration Court', city: 'Phoenix', state: 'AZ',
    courtStreet: '250 N. Seventh Ave., Suite 300', courtCityStateZip: 'Phoenix, AZ 85007',
    chiefCounselAddress: 'OPLA Phoenix\n2035 N. Central Avenue\nPhoenix, AZ 85004',
  },
  {
    key: 'Portland', name: 'Portland Immigration Court', city: 'Portland', state: 'OR',
    courtStreet: '1220 SW 3rd Avenue, Suite 500', courtCityStateZip: 'Portland, OR 97204',
    chiefCounselAddress: 'OPLA Portland\n1220 SW 3rd Avenue, Suite 300\nPortland, OR 97204',
  },
  {
    key: 'Sacramento', name: 'Sacramento Immigration Court', city: 'Sacramento', state: 'CA',
    courtStreet: 'John Moss Federal Building, 650 Capitol Mall, Suite 4-200', courtCityStateZip: 'Sacramento, CA 95814',
    chiefCounselAddress: 'OPLA Sacramento\n100 Montgomery Street, Suite 200\nSan Francisco, CA 94104',
  },
  {
    key: 'Salt Lake City', name: 'Salt Lake City Immigration Court', city: 'West Valley City', state: 'UT',
    courtStreet: '2975 South Decker Lake Drive, # 200', courtCityStateZip: 'West Valley City, UT 84119-6094',
    chiefCounselAddress: 'OPLA Salt Lake City\n2975 Decker Lake Drive, Stop C\nWest Valley City, UT 84119-6098',
  },
  {
    key: 'San Antonio', name: 'San Antonio Immigration Court', city: 'San Antonio', state: 'TX',
    courtStreet: '800 Dolorosa, Suite 300', courtCityStateZip: 'San Antonio, TX 78207',
    chiefCounselAddress: 'OPLA San Antonio\n1015 Jackson-Keller Road, Suite 100\nSan Antonio, TX 78213',
  },
  {
    key: 'San Diego', name: 'San Diego Immigration Court', city: 'San Diego', state: 'CA',
    courtStreet: '880 Front Street, Suite 4240', courtCityStateZip: 'San Diego, CA 92101',
    chiefCounselAddress: 'OPLA San Diego (Front St.)\n880 Front Street, Suite 2246\nSan Diego, CA 92101',
  },
  {
    key: 'San Francisco', name: 'San Francisco Immigration Court', city: 'San Francisco', state: 'CA',
    courtStreet: '100 Montgomery Street, Suite 800', courtCityStateZip: 'San Francisco, CA 94104',
    chiefCounselAddress: 'OPLA San Francisco (Montgomery St.)\n100 Montgomery Street, Suite 200\nSan Francisco, CA 94104',
    note: 'EOIR anunció cierre/reorganización de la corte de San Francisco en 2026: confirmar que sigue operando.',
  },
  {
    key: 'Santa Ana', name: 'Santa Ana Immigration Court', city: 'Santa Ana', state: 'CA',
    courtStreet: '1241 E. Dyer Road, Suite 200', courtCityStateZip: 'Santa Ana, CA 92705',
    chiefCounselAddress: 'OPLA Los Angeles (Santa Ana)\n1231 E. Dyer Road, Suite 155\nSanta Ana, CA 92705',
  },
  {
    key: 'Seattle', name: 'Seattle Immigration Court', city: 'Seattle', state: 'WA',
    courtStreet: '915 2nd Ave., Suite 613', courtCityStateZip: 'Seattle, WA 98174',
    chiefCounselAddress: 'OPLA Seattle\n915 Second Avenue, Suite 708\nSeattle, WA 98174',
  },
  {
    key: 'Sterling', name: 'Sterling Immigration Court', city: 'Sterling', state: 'VA',
    courtStreet: '21400 Ridgetop Circle, Suite 200', courtCityStateZip: 'Sterling, VA 20166',
    chiefCounselAddress: 'OPLA Sterling\n500 12th Street SW, Mail Stop 5906\nWashington, D.C. 20536-5906',
  },
  {
    key: 'Tucson', name: 'Tucson Immigration Court', city: 'Tucson', state: 'AZ',
    courtStreet: '300 West Congress, Suite 300', courtCityStateZip: 'Tucson, AZ 85701',
    chiefCounselAddress: 'OPLA Tucson\n6431 S. Country Club Road\nTucson, AZ 85706',
  },
  {
    key: 'Ulster', name: 'Ulster Immigration Court', city: 'Napanoch', state: 'NY',
    courtStreet: '750 Berme Road, PO Box 800', courtCityStateZip: 'Napanoch, NY 12458',
    chiefCounselAddress: 'OPLA New York (Newburgh)\nHudson Valley, 15 Governor Drive\nNewburgh, NY 12550',
  },
  // ── DETAINED dockets (menos probables para un traslado voluntario, pero válidos) ─
  {
    key: 'Adelanto', name: 'Adelanto Immigration Court', city: 'Adelanto', state: 'CA', detainedOnly: true,
    courtStreet: 'Adelanto Detention Facility, 10250 Rancho Road, Suite 201A', courtCityStateZip: 'Adelanto, CA 92301',
    chiefCounselAddress: 'OPLA Adelanto\n10250 Rancho Road\nAdelanto, CA 92301',
  },
  {
    key: 'Aurora', name: 'Aurora Immigration Court', city: 'Aurora', state: 'CO', detainedOnly: true,
    courtStreet: '3130 North Oakland Street', courtCityStateZip: 'Aurora, CO 80010',
    chiefCounselAddress: 'OPLA Aurora\n12445 East Caley Avenue\nCentennial, CO 80111-6432',
  },
  {
    key: 'Batavia', name: 'Batavia Immigration Court', city: 'Batavia', state: 'NY', detainedOnly: true,
    courtStreet: '4250 Federal Drive, Room F108', courtCityStateZip: 'Batavia, NY 14020',
    chiefCounselAddress: 'OPLA Batavia\nBuffalo Federal Detention Facility, 4250 Federal Drive\nBatavia, NY 14020',
  },
  {
    key: 'Conroe', name: 'Conroe Immigration Court', city: 'Conroe', state: 'TX', detainedOnly: true,
    courtStreet: '806 Hilbig Road, Suite 2-300, 2nd Floor', courtCityStateZip: 'Conroe, TX 77301',
    chiefCounselAddress: 'OPLA Conroe\nMontgomery Processing Center, 806 Hilbig Road, Suite 2-201\nConroe, TX 77301',
  },
  {
    key: 'El Paso SPC', name: 'El Paso SPC Immigration Court', city: 'El Paso', state: 'TX', detainedOnly: true,
    courtStreet: '8915 Montana Avenue, Suite 100', courtCityStateZip: 'El Paso, TX 79925',
    chiefCounselAddress: 'OPLA El Paso\n11541 Montana Avenue, Suite O\nEl Paso, TX 79936',
  },
  {
    key: 'Elizabeth', name: 'Elizabeth Immigration Court', city: 'Elizabeth', state: 'NJ', detainedOnly: true,
    courtStreet: '625 Evans Street, Room 148A', courtCityStateZip: 'Elizabeth, NJ 07201',
    chiefCounselAddress: 'Elizabeth Detention Facility\n625 Evans Street, Room 135\nElizabeth, NJ 07201',
  },
  {
    key: 'Eloy', name: 'Eloy Immigration Court', city: 'Eloy', state: 'AZ', detainedOnly: true,
    courtStreet: '1705 E. Hanna Road, Suite 366', courtCityStateZip: 'Eloy, AZ 85131',
    chiefCounselAddress: 'OPLA Eloy\n1705 E. Hanna Road\nEloy, AZ 85131',
  },
  {
    key: 'Florence', name: 'Florence Immigration Court', city: 'Florence', state: 'AZ', detainedOnly: true,
    courtStreet: '3260 N. Pinal Parkway Avenue', courtCityStateZip: 'Florence, AZ 85132',
    chiefCounselAddress: 'OPLA Florence\nFlorence Detention Center, 3250 N. Pinal Parkway Avenue\nFlorence, AZ 85132',
  },
  {
    key: 'Imperial', name: 'Imperial Immigration Court', city: 'Imperial', state: 'CA', detainedOnly: true,
    courtStreet: '2409 La Brucherie Road', courtCityStateZip: 'Imperial, CA 92251',
    chiefCounselAddress: 'OPLA Imperial\nHudson Valley, 15 Governor Drive\nNewburgh, NY 12550',
    note: 'OPLA listado en el handout parece erróneo (NY). Verificar OPLA local San Diego/Imperial.',
  },
  {
    key: 'LaSalle', name: 'LaSalle Immigration Court', city: 'Jena', state: 'LA', detainedOnly: true,
    courtStreet: '830 Pine Hill Road, P.O. Box 2179', courtCityStateZip: 'Jena, LA 71342',
    chiefCounselAddress: 'OPLA Jena\nLaSalle Detention Center, 830 Pinehill Road\nJena, LA 71342',
  },
  {
    key: 'Miami Krome', name: 'Miami Krome Immigration Court', city: 'Miami', state: 'FL', detainedOnly: true,
    courtStreet: 'Krome North Processing Center, 18201 SW 12th Street', courtCityStateZip: 'Miami, FL 33194',
    chiefCounselAddress: 'OPLA Miami (Krome)\nKrome Service Processing Center, 18201 SW 12th Street\nMiami, FL 33194-2700',
  },
  {
    key: 'Otay Mesa', name: 'Otay Mesa Immigration Court', city: 'San Diego', state: 'CA', detainedOnly: true,
    courtStreet: 'P.O. Box 438150', courtCityStateZip: 'San Ysidro, CA 92143-8150',
    chiefCounselAddress: 'OPLA San Diego (Otay Mesa)\n7488 Calzada de la Fuente\nSan Diego, CA 92154',
  },
  {
    key: 'Otero', name: 'Otero Immigration Court', city: 'Chaparral', state: 'NM', detainedOnly: true,
    courtStreet: '26 McGregor Range Road, Door #1', courtCityStateZip: 'Chaparral, NM 88081',
    chiefCounselAddress: 'OPLA Chaparral\nTrial Attorney Unit, 26 McGregor Range Road\nChaparral, NM 88081',
  },
  {
    key: 'Pearsall', name: 'Pearsall Immigration Court', city: 'Pearsall', state: 'TX', detainedOnly: true,
    courtStreet: '566 Veterans Drive', courtCityStateZip: 'Pearsall, TX 78061',
    chiefCounselAddress: 'OPLA Pearsall\nSouth Texas ICE Processing Center, 566 Veterans Drive\nPearsall, TX 78061',
  },
  {
    key: 'Port Isabel', name: 'Port Isabel Immigration Court', city: 'Los Fresnos', state: 'TX', detainedOnly: true,
    courtStreet: '27991 Buena Vista Blvd.', courtCityStateZip: 'Los Fresnos, TX 78566',
    chiefCounselAddress: 'OPLA Port Isabel\n27991 Buena Vista Blvd.\nLos Fresnos, TX 78566',
  },
  {
    key: 'Stewart', name: 'Stewart Immigration Court', city: 'Lumpkin', state: 'GA', detainedOnly: true,
    courtStreet: '146 CCA Road, PO Box 248', courtCityStateZip: 'Lumpkin, GA 31815',
    chiefCounselAddress: 'OPLA Lumpkin\nStewart County Detention Facility, 146 CCA Road\nLumpkin, GA 31815',
  },
  {
    key: 'Tacoma', name: 'Tacoma Immigration Court', city: 'Tacoma', state: 'WA', detainedOnly: true,
    courtStreet: '1623 East J Street, Suite 3', courtCityStateZip: 'Tacoma, WA 98421',
    chiefCounselAddress: 'OPLA Tacoma\nNorthwest ICE Processing Center, 1623 East J Street, Suite 2\nTacoma, WA 98421',
  },
]

/** Índice estado(2 letras) → cortes que operan en ese estado. Para acotar el
 *  contexto que se envía a Claude y como fallback determinista. */
export const COURTS_BY_STATE: Record<string, EoirCourt[]> = EOIR_COURTS.reduce(
  (acc, c) => {
    ;(acc[c.state] ??= []).push(c)
    return acc
  },
  {} as Record<string, EoirCourt[]>,
)

/** Serializa el catálogo (o un subconjunto) a texto compacto para el prompt. */
export function serializeCourtsForPrompt(courts: EoirCourt[] = EOIR_COURTS): string {
  return courts
    .map((c) => {
      const cc = c.chiefCounselAddress.replace(/\n/g, ' | ')
      const flags = c.detainedOnly ? ' [DETAINED]' : ''
      const note = c.note ? ` (nota: ${c.note})` : ''
      return `- ${c.name}${flags} — Corte: ${c.courtStreet}, ${c.courtCityStateZip} — Chief Counsel/OPLA: ${cc}${note}`
    })
    .join('\n')
}
