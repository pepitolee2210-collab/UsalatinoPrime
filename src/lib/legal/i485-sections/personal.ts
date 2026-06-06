// Curación de presentación al cliente del I-485 — datos personales, entrada a
// EE.UU., direcciones, Seguro Social, contacto y datos físicos (Parts 1 y 8).
// FUENTE DE VERDAD editable a mano: las preguntas/labels en español salen del
// tooltip oficial de cada campo (ver scripts/i485-tooltips.json). La composición
// y la verificación de integridad viven en ../i485-client-form.ts.
import type { CuratedSection } from '../i485-client-form'

export const PERSONAL_SECTIONS: CuratedSection[] = [
// ── 1. Tus datos personales ───────────────────────────────────────────
  {
    id: 1,
    titleEs: 'Tus datos personales',
    descriptionEs: 'Tu nombre completo, fecha y lugar de nacimiento. Escríbelo tal como aparece en tus documentos oficiales (pasaporte o acta de nacimiento).',
    groups: {
      otros_nombres: {
        title: 'Otros nombres que hayas usado',
        description: 'Apodos, tu nombre de soltera, o cualquier otro nombre con el que te conozcan. Si nunca usaste otro, deja esto vacío.',
        tone: 'plain',
      },
      cuenta_uscis: {
        title: 'Tu cuenta de USCIS (solo si ya tienes una)',
        description: 'Si alguna vez abriste una cuenta en línea con inmigración (USCIS), tienes un número de cuenta. Si nunca lo hiciste, deja esto vacío.',
        tone: 'plain',
      },
    },
    fields: [
      { key: 'pt1line1_familyname', labelEs: 'Apellidos', helpEs: 'Tus apellidos, como aparecen en tu pasaporte o acta de nacimiento.', required: true },
      { key: 'pt1line1_givenname', labelEs: 'Primer nombre', required: true },
      { key: 'pt1line1_middlename', labelEs: 'Segundo nombre', helpEs: 'Si no tienes, déjalo vacío.' },

      { key: 'pt1line2_familyname', labelEs: 'Otro apellido que hayas usado', groupKey: 'otros_nombres' },
      { key: 'pt1line2_givenname', labelEs: 'Otro nombre que hayas usado', groupKey: 'otros_nombres' },
      { key: 'pt1line2_middlename', labelEs: 'Otro segundo nombre', groupKey: 'otros_nombres' },
      { key: 'pt1line2a_familyname', labelEs: 'Otro apellido más (si usaste varios)', groupKey: 'otros_nombres' },
      { key: 'pt1line2a_givenname', labelEs: 'Otro nombre más', groupKey: 'otros_nombres' },
      { key: 'pt1line2a_middlename', labelEs: 'Otro segundo nombre más', groupKey: 'otros_nombres' },

      { key: 'pt1line3_dob', labelEs: 'Fecha de nacimiento', helpEs: 'Escríbela como mes/día/año. Ejemplo: 03/25/2008.', required: true },

      {
        key: 'v_sex',
        type: 'radio',
        labelEs: 'Sexo (como aparece en tus documentos)',
        required: true,
        options: [
          { value: 'F', labelEs: 'Femenino' },
          { value: 'M', labelEs: 'Masculino' },
        ],
        real: { F: 'pt1line6_cb_sex', M: 'pt1line6_cb_sex_1' },
      },

      { key: 'pt1line7_citytownofbirth', labelEs: 'Ciudad donde naciste', required: true },
      { key: 'pt1line7_countryofbirth', labelEs: 'País donde naciste', required: true },
      { key: 'pt1line8_countryofcitizenshipnationality', labelEs: 'País del que eres ciudadano', helpEs: 'El país que te dio tu nacionalidad o pasaporte.', required: true },

      { key: 'pt1line9_uscisaccountnumber', labelEs: 'Número de cuenta en línea de USCIS', helpEs: 'Son 12 caracteres. Solo si ya tienes una cuenta con inmigración; si no, déjalo vacío.', groupKey: 'cuenta_uscis', maxLength: 12 },
    ],
  },

  // ── 2. Tu historia de entrada a EE.UU. ────────────────────────────────
  {
    id: 2,
    titleEs: 'Tu historia de entrada a EE.UU.',
    descriptionEs: 'Cómo y cuándo entraste por última vez al país, y tu situación migratoria. Si no recuerdas algún dato, pregúntale a tu abogado antes de adivinar.',
    groups: {
      anumber: {
        title: 'Tu número de extranjero (A-Number)',
        description: 'Es un número que inmigración le da a algunas personas. Empieza con la letra "A" y lo encuentras en cartas o documentos de inmigración. Si nunca te dieron uno, responde "No".',
        tone: 'plain',
      },
      ultima_entrada: {
        title: 'Tu última entrada al país',
        description: 'La fecha y el lugar por donde entraste a EE.UU. la última vez.',
        tone: 'plain',
      },
      i94: {
        title: 'Tu permiso de entrada (formulario I-94)',
        description: 'Cuando entras a EE.UU. te dan un registro llamado I-94. Tiene un número y una fecha hasta la que puedes quedarte. Lo puedes buscar en línea en la página de CBP si no lo tienes a mano.',
        tone: 'plain',
      },
      estatus: {
        title: 'Tu situación migratoria',
        description: 'Con qué permiso entraste y cuál es tu situación ahora.',
        tone: 'plain',
      },
    },
    fields: [
      // Item 4: ¿Tiene A-Number?
      {
        key: 'v_has_anumber',
        type: 'radio',
        labelEs: '¿Tienes un número de extranjero (A-Number)?',
        helpEs: 'Es un número que empieza con "A". Aparece en documentos de inmigración. Si nunca te dieron uno, marca "No".',
        groupKey: 'anumber',
        defaultValue: 'N',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
        ],
        real: { Y: 'pt1line4_yn', N: 'pt1line4_yn_1' },
      },
      { key: 'pt1line4_aliennumber', labelEs: 'Tu número de extranjero (A-Number)', helpEs: 'Son 9 dígitos. Escríbelo sin la letra "A".', groupKey: 'anumber', maxLength: 9, dependsOn: { key: 'v_has_anumber', equals: 'Y' } },

      // Item 5: ¿Ha usado otro A-Number?
      {
        key: 'v_used_other_anumber',
        type: 'radio',
        labelEs: '¿Alguna vez usaste o te dieron otro número de extranjero distinto?',
        groupKey: 'anumber',
        defaultValue: 'N',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
        ],
        real: { Y: 'pt1line5_yn', N: 'pt1line5_yn_1' },
      },
      { key: 'pt1line5a_anumber', labelEs: 'Otro número de extranjero que usaste', groupKey: 'anumber', dependsOn: { key: 'v_used_other_anumber', equals: 'Y' } },
      { key: 'pt1line5b_anumber', labelEs: 'Otro número de extranjero más (si tienes)', groupKey: 'anumber', dependsOn: { key: 'v_used_other_anumber', equals: 'Y' } },

      // Item 10: lugar y fecha de última entrada
      { key: 'pt1line10_dateofarrival', labelEs: 'Fecha de tu última entrada a EE.UU.', helpEs: 'Como mes/día/año. Ejemplo: 06/15/2022.', groupKey: 'ultima_entrada' },
      { key: 'pt1line10_citytown', labelEs: 'Ciudad por donde entraste', groupKey: 'ultima_entrada', maxLength: 20 },
      { key: 'pt1line10_state', labelEs: 'Estado por donde entraste', helpEs: 'Elige el estado de la lista.', groupKey: 'ultima_entrada' },

      // Item 12: I-94
      { key: 'p1line12_i94', labelEs: 'Número de tu permiso de entrada (I-94)', helpEs: 'Son 11 caracteres. Si no lo tienes, búscalo en línea en la página de CBP (i94.cbp.dhs.gov).', groupKey: 'i94', maxLength: 11 },
      { key: 'p1line12_familyname', labelEs: 'Apellidos como aparecen en tu I-94', groupKey: 'i94' },
      { key: 'p1line13_givenname', labelEs: 'Nombre como aparece en tu I-94', groupKey: 'i94' },
      { key: 'pt1line12_status', labelEs: 'Estatus con el que entraste (según el I-94)', helpEs: 'Por ejemplo: turista, estudiante, o "paroled" si entraste con permiso especial. Si no sabes, pregúntale a tu abogado.', groupKey: 'i94', maxLength: 20 },
      { key: 'pt1line12_date', labelEs: 'Fecha hasta la que puedes quedarte (según el I-94)', helpEs: 'Como mes/día/año. Si tu I-94 dice "D/S" (duración del estatus), escribe D/S.', groupKey: 'i94' },

      // Item 13: ¿primera vez en EE.UU.?
      {
        key: 'v_first_time_us',
        type: 'radio',
        labelEs: '¿Tu última entrada fue la primera vez que estuviste en EE.UU.?',
        groupKey: 'estatus',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
        ],
        real: { Y: 'pt1line13_yn', N: 'pt1line13_yn_1' },
      },

      // Item 14: estatus actual
      { key: 'pt1line14_status', labelEs: 'Tu situación migratoria actual', helpEs: 'Solo si cambió desde que entraste. Si no cambió, déjalo vacío.', groupKey: 'estatus', maxLength: 20 },

      // Item 15: fecha de expiración del estatus actual
      { key: 'pt1line15_date', labelEs: 'Fecha en que vence tu situación migratoria actual', helpEs: 'Como mes/día/año. Si tu permiso dice "D/S" (duración del estatus), escribe D/S.', groupKey: 'estatus' },

      // Item 16: visa de tripulante (alien crewman)
      {
        key: 'v_crewman_visa',
        type: 'radio',
        labelEs: '¿Alguna vez te dieron una visa de tripulante de barco o avión ("alien crewman")?',
        groupKey: 'estatus',
        defaultValue: 'N',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
        ],
        real: { Y: 'pt1line16_yn', N: 'pt1line16_yn_1' },
      },

      // Item 17: ¿entró para servir en un barco/avión? (¡onValue invertido en el PDF!)
      {
        key: 'v_arrived_as_crewman',
        type: 'radio',
        labelEs: '¿Tu última entrada fue para trabajar como tripulante o marinero de un barco o avión?',
        groupKey: 'estatus',
        defaultValue: 'N',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
        ],
        real: { Y: 'pt1line17_yn_1', N: 'pt1line17_yn' },
      },
    ],
  },

  // ── 3. Tus direcciones ────────────────────────────────────────────────
  {
    id: 3,
    titleEs: 'Tus direcciones',
    descriptionEs: 'Dónde vives ahora y a dónde quieres que te llegue el correo. Inmigración te enviará cartas importantes a la dirección postal, así que asegúrate de que sea un lugar seguro.',
    groups: {
      direccion_fisica: {
        title: 'Dónde vives ahora',
        description: 'Tu dirección física actual: el lugar donde realmente vives, no un apartado postal.',
        tone: 'plain',
      },
      direccion_postal: {
        title: 'A dónde te llega el correo (dirección postal segura)',
        description: 'Aquí inmigración te enviará cartas. Puede ser distinta a donde vives. En casos de jóvenes, puede ser la dirección del abogado para mayor seguridad. Pregúntale a tu abogado qué conviene.',
        tone: 'plain',
      },
      direccion_anterior: {
        title: 'Tu dirección anterior',
        description: 'Si vives donde estás ahora hace menos de 5 años, dinos dónde vivías antes.',
        tone: 'plain',
      },
      direccion_fuera: {
        title: 'Tu última dirección fuera de EE.UU.',
        description: 'El último lugar donde viviste fuera de Estados Unidos por más de un año (si no lo pusiste arriba).',
        tone: 'plain',
      },
    },
    fields: [
      // Dirección física actual (item 18)
      { key: 'part1_item18_incareofname', labelEs: 'A nombre de quién llega (si vives en casa de otra persona)', helpEs: 'Solo si tu correo llega a nombre de otra persona. Si no, déjalo vacío.', groupKey: 'direccion_fisica', maxLength: 34 },
      { key: 'pt1line18_streetnumbername', labelEs: 'Calle y número', groupKey: 'direccion_fisica', maxLength: 34 },
      {
        key: 'v_phys_unit',
        type: 'radio',
        labelEs: '¿Vives en un apartamento, suite o piso?',
        helpEs: 'Elige uno solo si aplica; si no, déjalo en blanco.',
        groupKey: 'direccion_fisica',
        options: [
          { value: 'apt', labelEs: 'Apartamento' },
          { value: 'ste', labelEs: 'Suite' },
          { value: 'flr', labelEs: 'Piso' },
        ],
        real: { apt: 'pt1line18us_unit_2', ste: 'pt1line18us_unit', flr: 'pt1line18us_unit_1' },
      },
      { key: 'pt1line18us_aptsteflrnumber', labelEs: 'Número de apartamento, suite o piso', groupKey: 'direccion_fisica', maxLength: 6 },
      { key: 'pt1line18_cityortown', labelEs: 'Ciudad', groupKey: 'direccion_fisica', maxLength: 20 },
      { key: 'pt1line18_state', labelEs: 'Estado', helpEs: 'Elige el estado de la lista.', groupKey: 'direccion_fisica' },
      { key: 'pt1line18_zipcode', labelEs: 'Código postal (ZIP)', helpEs: 'Los 5 números del código postal.', groupKey: 'direccion_fisica', maxLength: 5 },
      { key: 'pt1line18_date', labelEs: 'Desde cuándo vives aquí', helpEs: 'Como mes/día/año. La fecha en que llegaste a esta dirección.', groupKey: 'direccion_fisica' },

      // ¿La dirección postal es la misma que la física? (item 18)
      {
        key: 'v_mailing_same',
        type: 'radio',
        labelEs: '¿Tu correo te llega a esta misma dirección?',
        helpEs: 'Si quieres recibir las cartas de inmigración en otro lugar (por ejemplo, la oficina del abogado), responde "No" y dinos a dónde.',
        groupKey: 'direccion_postal',
        defaultValue: 'Y',
        options: [
          { value: 'Y', labelEs: 'Sí, a la misma dirección' },
          { value: 'N', labelEs: 'No, a otra dirección' },
        ],
        real: { Y: 'pt1line18_yn', N: 'pt1line18_yn_1' },
      },
      // Dirección postal segura (solo si respondió No)
      { key: 'pt1line18_currentincareofname', labelEs: 'A nombre de quién llega el correo', helpEs: 'Por ejemplo, el nombre del abogado o de quien recibe tu correo.', groupKey: 'direccion_postal', maxLength: 34, dependsOn: { key: 'v_mailing_same', equals: 'N' } },
      { key: 'pt1line18_currentstreetnumbername', labelEs: 'Calle y número (correo)', groupKey: 'direccion_postal', maxLength: 34, dependsOn: { key: 'v_mailing_same', equals: 'N' } },
      {
        key: 'v_mailing_unit',
        type: 'radio',
        labelEs: '¿Es apartamento, suite o piso? (correo)',
        groupKey: 'direccion_postal',
        options: [
          { value: 'apt', labelEs: 'Apartamento' },
          { value: 'ste', labelEs: 'Suite' },
          { value: 'flr', labelEs: 'Piso' },
        ],
        real: { apt: 'pt1line18_currentunit', ste: 'pt1line18_currentunit_1', flr: 'pt1line18_currentunit_2' },
        dependsOn: { key: 'v_mailing_same', equals: 'N' },
      },
      { key: 'pt1line18_currentaptsteflrnumber', labelEs: 'Número de apartamento, suite o piso (correo)', groupKey: 'direccion_postal', maxLength: 6, dependsOn: { key: 'v_mailing_same', equals: 'N' } },
      { key: 'pt1line18_currentcityortown', labelEs: 'Ciudad (correo)', groupKey: 'direccion_postal', maxLength: 20, dependsOn: { key: 'v_mailing_same', equals: 'N' } },
      { key: 'pt1line18_currentstate', labelEs: 'Estado (correo)', groupKey: 'direccion_postal', dependsOn: { key: 'v_mailing_same', equals: 'N' } },
      { key: 'pt1line18_currentzipcode', labelEs: 'Código postal (ZIP) (correo)', groupKey: 'direccion_postal', maxLength: 5, dependsOn: { key: 'v_mailing_same', equals: 'N' } },

      // ¿Lleva 5 años en la dirección actual? (item 18)
      {
        key: 'v_lived_5yrs',
        type: 'radio',
        labelEs: '¿Has vivido en tu dirección actual por al menos 5 años?',
        helpEs: 'Si respondes "No", dinos dónde vivías antes.',
        groupKey: 'direccion_anterior',
        defaultValue: 'N',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
        ],
        real: { Y: 'pt1line18_last5yrs_yn', N: 'pt1line18_last5yrs_yn_1' },
      },
      // Dirección anterior (solo si NO lleva 5 años)
      { key: 'pt1line18_priorincareofname', labelEs: 'A nombre de quién llegaba (dirección anterior)', groupKey: 'direccion_anterior', maxLength: 34, dependsOn: { key: 'v_lived_5yrs', equals: 'N' } },
      { key: 'pt1line18_priorstreetname', labelEs: 'Calle y número (dirección anterior)', groupKey: 'direccion_anterior', maxLength: 34, dependsOn: { key: 'v_lived_5yrs', equals: 'N' } },
      {
        key: 'v_prior_unit',
        type: 'radio',
        labelEs: '¿Era apartamento, suite o piso? (dirección anterior)',
        groupKey: 'direccion_anterior',
        options: [
          { value: 'apt', labelEs: 'Apartamento' },
          { value: 'ste', labelEs: 'Suite' },
          { value: 'flr', labelEs: 'Piso' },
        ],
        real: { apt: 'pt1line18_prioraddress_unit', ste: 'pt1line18_prioraddress_unit_1', flr: 'pt1line18_prioraddress_unit_2' },
        dependsOn: { key: 'v_lived_5yrs', equals: 'N' },
      },
      { key: 'pt1line18_prioraddress_number', labelEs: 'Número de apartamento, suite o piso (dirección anterior)', groupKey: 'direccion_anterior', maxLength: 6, dependsOn: { key: 'v_lived_5yrs', equals: 'N' } },
      { key: 'pt1line18_priorcity', labelEs: 'Ciudad (dirección anterior)', groupKey: 'direccion_anterior', maxLength: 28, dependsOn: { key: 'v_lived_5yrs', equals: 'N' } },
      { key: 'pt1line18_priorstate', labelEs: 'Estado (dirección anterior)', helpEs: 'Solo si quedaba en EE.UU.', groupKey: 'direccion_anterior', dependsOn: { key: 'v_lived_5yrs', equals: 'N' } },
      { key: 'pt1line18_priorzipcode', labelEs: 'Código postal (ZIP) (dirección anterior)', groupKey: 'direccion_anterior', maxLength: 5, dependsOn: { key: 'v_lived_5yrs', equals: 'N' } },
      { key: 'pt1line18_priorprovince', labelEs: 'Provincia (si quedaba fuera de EE.UU.)', groupKey: 'direccion_anterior', maxLength: 20, dependsOn: { key: 'v_lived_5yrs', equals: 'N' } },
      { key: 'pt1line18_priorpostalcode', labelEs: 'Código postal extranjero (si quedaba fuera de EE.UU.)', groupKey: 'direccion_anterior', maxLength: 9, dependsOn: { key: 'v_lived_5yrs', equals: 'N' } },
      { key: 'pt1line18_priorcountry', labelEs: 'País (dirección anterior)', groupKey: 'direccion_anterior', dependsOn: { key: 'v_lived_5yrs', equals: 'N' } },
      { key: 'pt1line18_priordatefrom', labelEs: 'Desde cuándo viviste ahí (dirección anterior)', helpEs: 'Como mes/día/año.', groupKey: 'direccion_anterior', dependsOn: { key: 'v_lived_5yrs', equals: 'N' } },
      { key: 'pt1line18priordateto', labelEs: 'Hasta cuándo viviste ahí (dirección anterior)', helpEs: 'Como mes/día/año.', groupKey: 'direccion_anterior', dependsOn: { key: 'v_lived_5yrs', equals: 'N' } },

      // Dirección más reciente fuera de EE.UU.
      { key: 'pt1line18_recentstreetname', labelEs: 'Calle y número (fuera de EE.UU.)', groupKey: 'direccion_fuera', maxLength: 34 },
      {
        key: 'v_recent_unit',
        type: 'radio',
        labelEs: '¿Era apartamento, suite o piso? (fuera de EE.UU.)',
        groupKey: 'direccion_fuera',
        options: [
          { value: 'apt', labelEs: 'Apartamento' },
          { value: 'ste', labelEs: 'Suite' },
          { value: 'flr', labelEs: 'Piso' },
        ],
        real: { apt: 'pt1line18_recentunit', ste: 'pt1line18_recentunit_1', flr: 'pt1line18_recentunit_2' },
      },
      { key: 'pt1line18_recentnumber', labelEs: 'Número de apartamento, suite o piso (fuera de EE.UU.)', groupKey: 'direccion_fuera', maxLength: 6 },
      { key: 'pt1line18_recentcity', labelEs: 'Ciudad (fuera de EE.UU.)', groupKey: 'direccion_fuera', maxLength: 28 },
      { key: 'pt1line18_recentprovince', labelEs: 'Provincia (fuera de EE.UU.)', groupKey: 'direccion_fuera', maxLength: 20 },
      { key: 'pt1line18_recentpostalcode', labelEs: 'Código postal (fuera de EE.UU.)', groupKey: 'direccion_fuera', maxLength: 9 },
      { key: 'pt1line18_recentcountry', labelEs: 'País (fuera de EE.UU.)', groupKey: 'direccion_fuera' },
      { key: 'pt1line18_recentdatefrom', labelEs: 'Desde cuándo viviste ahí (fuera de EE.UU.)', helpEs: 'Como mes/día/año.', groupKey: 'direccion_fuera' },
      { key: 'pt1line18_recentdateto', labelEs: 'Hasta cuándo viviste ahí (fuera de EE.UU.)', helpEs: 'Como mes/día/año.', groupKey: 'direccion_fuera' },
    ],
  },

  // ── 4. Tu número de Seguro Social ─────────────────────────────────────
  {
    id: 4,
    titleEs: 'Tu número de Seguro Social',
    descriptionEs: 'Sobre tu tarjeta de Seguro Social (Social Security). Si nunca has tenido una, puedes pedir que te la emitan aquí mismo.',
    groups: {
      ssn: {
        title: 'Tu tarjeta de Seguro Social',
        description: 'El Seguro Social es un número que usas para trabajar y pagar impuestos en EE.UU.',
        tone: 'plain',
      },
    },
    fields: [
      // Item 19: ¿le emitieron tarjeta SSN? (¡onValue invertido en el PDF!)
      {
        key: 'v_has_ssn_card',
        type: 'radio',
        labelEs: '¿El Seguro Social (SSA) alguna vez te dio una tarjeta de Seguro Social?',
        groupKey: 'ssn',
        defaultValue: 'N',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
        ],
        real: { Y: 'pt1line19_yn_1', N: 'pt1line19_yn' },
      },
      { key: 'pt1line19_ssn', labelEs: 'Tu número de Seguro Social (SSN)', helpEs: 'Son 9 dígitos. Solo si ya tienes uno.', groupKey: 'ssn', maxLength: 9, dependsOn: { key: 'v_has_ssn_card', equals: 'Y' } },

      // Item 19: ¿quiere que la SSA le emita una tarjeta?
      {
        key: 'v_want_ssn_card',
        type: 'radio',
        labelEs: '¿Quieres que el Seguro Social (SSA) te emita una tarjeta?',
        groupKey: 'ssn',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
        ],
        real: { Y: 'pt1line19_ssa_yn', N: 'pt1line19_ssa_yn_1' },
      },
      // Consentimiento para compartir tus datos con la SSA (solo si quiere la tarjeta)
      {
        key: 'v_ssn_consent',
        type: 'radio',
        labelEs: '¿Autorizas a inmigración a compartir tus datos con el Seguro Social para darte tu número y tu tarjeta?',
        helpEs: 'Para que te emitan la tarjeta, normalmente hay que dar este permiso.',
        groupKey: 'ssn',
        options: [
          { value: 'Y', labelEs: 'Sí, autorizo' },
          { value: 'N', labelEs: 'No autorizo' },
        ],
        real: { Y: 'pt1line19_consent_yn', N: 'pt1line19_consent_yn_1' },
        dependsOn: { key: 'v_want_ssn_card', equals: 'Y' },
      },
    ],
  },

  // ── 5. Tu contacto ────────────────────────────────────────────────────
  {
    id: 5,
    titleEs: 'Tu contacto',
    descriptionEs: 'Cómo podemos comunicarnos contigo. Usa números y un correo que revises seguido.',
    groups: {
      contacto: {
        title: 'Tus datos de contacto',
        description: 'Tu teléfono, celular y correo electrónico.',
        tone: 'plain',
      },
    },
    fields: [
      { key: 'pt3line3_daytimephonenumber1', labelEs: 'Teléfono de día', helpEs: 'Un número donde te podamos llamar durante el día.', groupKey: 'contacto' },
      { key: 'pt3line4_mobilenumber1', labelEs: 'Celular', helpEs: 'Si no tienes, déjalo vacío.', groupKey: 'contacto' },
      { key: 'pt3line5_email', labelEs: 'Correo electrónico', helpEs: 'Si no tienes, déjalo vacío.', groupKey: 'contacto' },
    ],
  },

  // ── 6. Cómo te ves (datos físicos) ────────────────────────────────────
  {
    id: 6,
    titleEs: 'Cómo te ves (datos físicos)',
    descriptionEs: 'Inmigración pide estos datos para el formulario. Responde lo que mejor te describa; no hay respuestas buenas o malas.',
    groups: {
      origen: {
        title: 'Tu origen',
        description: 'Inmigración usa estas categorías oficiales del gobierno de EE.UU. Marca lo que mejor te describa.',
        tone: 'plain',
      },
      raza: {
        title: 'Tu raza (marca todas las que apliquen)',
        description: 'Puedes marcar más de una. Son las categorías oficiales del gobierno de EE.UU.',
        tone: 'plain',
      },
      cuerpo: {
        title: 'Estatura y peso',
        description: 'En el sistema de EE.UU.: la estatura en pies y pulgadas, el peso en libras.',
        tone: 'plain',
      },
      ojos_cabello: {
        title: 'Color de ojos y cabello',
        description: 'Elige el color que más se parezca al tuyo.',
        tone: 'plain',
      },
    },
    fields: [
      // Etnia (una sola opción)
      {
        key: 'v_ethnicity',
        type: 'radio',
        labelEs: '¿Eres hispano o latino?',
        groupKey: 'origen',
        options: [
          { value: 'H', labelEs: 'Sí, soy hispano o latino' },
          { value: 'N', labelEs: 'No soy hispano ni latino' },
        ],
        real: { H: 'pt7line1_ethnicity', N: 'pt7line1_ethnicity_1' },
      },

      // Raza (marca todas las que apliquen — checkboxes REALES, no virtual)
      { key: 'pt7line2_race', labelEs: 'Asiático', groupKey: 'raza' },
      { key: 'pt7line2_race_1', labelEs: 'Blanco', groupKey: 'raza' },
      { key: 'pt7line2_race_2', labelEs: 'Negro o Afroamericano', groupKey: 'raza' },
      { key: 'pt7line2_race_3', labelEs: 'Indígena Americano o Nativo de Alaska', groupKey: 'raza' },
      { key: 'pt7line2_race_4', labelEs: 'Nativo de Hawái u otra isla del Pacífico', groupKey: 'raza' },

      // Estatura (selects reales) y peso (3 dígitos reales)
      { key: 'pt7line3_heightfeet', labelEs: 'Estatura: pies', helpEs: 'Elige cuántos pies mides. Ejemplo: 5.', groupKey: 'cuerpo' },
      { key: 'pt7line3_heightinches', labelEs: 'Estatura: pulgadas', helpEs: 'Elige las pulgadas que sobran. Ejemplo: 7.', groupKey: 'cuerpo' },
      { key: 'pt7line4_weight1', labelEs: 'Peso (primer dígito)', helpEs: 'Tu peso en libras, dígito por dígito. Ejemplo: para 150 libras, escribe 1, 5, 0.', groupKey: 'cuerpo', maxLength: 1 },
      { key: 'pt7line4_weight2', labelEs: 'Peso (segundo dígito)', groupKey: 'cuerpo', maxLength: 1 },
      { key: 'pt7line4_weight3', labelEs: 'Peso (tercer dígito)', groupKey: 'cuerpo', maxLength: 1 },

      // Color de ojos (una sola opción)
      {
        key: 'v_eye_color',
        type: 'select',
        labelEs: 'Color de ojos',
        groupKey: 'ojos_cabello',
        options: [
          { value: 'BL', labelEs: 'Negros' },
          { value: 'BN', labelEs: 'Cafés (marrones)' },
          { value: 'BU', labelEs: 'Azules' },
          { value: 'GR', labelEs: 'Grises' },
          { value: 'GN', labelEs: 'Verdes' },
          { value: 'HA', labelEs: 'Avellana' },
          { value: 'MA', labelEs: 'Marrón rojizo' },
          { value: 'PN', labelEs: 'Rosados' },
          { value: 'UN', labelEs: 'No sé / Otro' },
        ],
        real: {
          BL: 'pt7line5_eyecolor_1',
          BN: 'pt7line5_eyecolor_2',
          BU: 'pt7line5_eyecolor',
          GR: 'pt7line5_eyecolor_3',
          GN: 'pt7line5_eyecolor_4',
          HA: 'pt7line5_eyecolor_5',
          MA: 'pt7line5_eyecolor_6',
          PN: 'pt7line5_eyecolor_7',
          UN: 'pt7line5_eyecolor_8',
        },
      },

      // Color de cabello (una sola opción)
      {
        key: 'v_hair_color',
        type: 'select',
        labelEs: 'Color de cabello',
        groupKey: 'ojos_cabello',
        options: [
          { value: 'BL', labelEs: 'Negro' },
          { value: 'BN', labelEs: 'Rubio' },
          { value: 'BR', labelEs: 'Café (castaño)' },
          { value: 'RD', labelEs: 'Rojo (pelirrojo)' },
          { value: 'GR', labelEs: 'Canoso (gris)' },
          { value: 'SA', labelEs: 'Rubio claro (arena)' },
          { value: 'WH', labelEs: 'Blanco' },
          { value: 'NH', labelEs: 'Calvo (sin cabello)' },
          { value: 'OT', labelEs: 'No sé / Otro' },
        ],
        real: {
          BL: 'pt7line6_haircolor_1',
          BN: 'pt7line6_haircolor_2',
          BR: 'pt7line6_haircolor_3',
          RD: 'pt7line6_haircolor_5',
          GR: 'pt7line6_haircolor_4',
          SA: 'pt7line6_haircolor_6',
          WH: 'pt7line6_haircolor_7',
          NH: 'pt7line6_haircolor',
          OT: 'pt7line6_haircolor_8',
        },
      },
    ],
  }
]
