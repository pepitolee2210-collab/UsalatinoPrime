// Curación de presentación al cliente del I-485 — historia previa, trabajo y
// estudios, padres, estado civil e hijos (Parts 4, 5, 6 y 7).
// FUENTE DE VERDAD editable a mano: las preguntas/labels en español salen del
// tooltip oficial de cada campo (ver scripts/i485-tooltips.json). La composición
// y la verificación de integridad viven en ../i485-client-form.ts.
import type { CuratedSection } from '../i485-client-form'

export const FAMILY_SECTIONS: CuratedSection[] = [
// ── 4. Antes de esta solicitud ─────────────────────────────────────────
  {
    id: 4,
    titleEs: 'Antes de esta solicitud',
    descriptionEs: 'Cuéntanos si ya habías pedido una visa de inmigrante o la residencia antes. Para la mayoría de las personas la respuesta es "No". Si no estás seguro, deja "No" y avísale a tu abogado.',
    groups: {
      visa_previa: {
        title: 'Si pediste una visa antes',
        description: 'Solo si arriba pusiste "Sí". Pon lo que recuerdes; si no sabes algún dato, déjalo vacío.',
        tone: 'plain',
      },
    },
    fields: [
      {
        key: 'v_applied_immigrant_visa',
        type: 'radio',
        labelEs: '¿Alguna vez pediste una visa de inmigrante (la residencia) en una embajada o consulado de Estados Unidos en otro país?',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
        ],
        defaultValue: 'N',
        real: { Y: 'pt4line1_yn_1', N: 'pt4line1_yn' },
      },
      {
        key: 'pt4line2_citytown',
        labelEs: 'Ciudad de la embajada o consulado de EE.UU.',
        groupKey: 'visa_previa',
        dependsOn: { key: 'v_applied_immigrant_visa', equals: 'Y' },
      },
      {
        key: 'pt4line2_citytownofbirth',
        labelEs: 'País de la embajada o consulado',
        groupKey: 'visa_previa',
        dependsOn: { key: 'v_applied_immigrant_visa', equals: 'Y' },
      },
      {
        key: 'pt4line3_decision',
        labelEs: '¿Qué pasó con esa solicitud?',
        helpEs: 'Por ejemplo: aprobada, rechazada, negada o retirada.',
        groupKey: 'visa_previa',
        dependsOn: { key: 'v_applied_immigrant_visa', equals: 'Y' },
      },
      {
        key: 'pt4line4_date',
        labelEs: 'Fecha de la decisión',
        helpEs: 'Escríbela como mes/día/año. Ejemplo: 03/25/2020.',
        groupKey: 'visa_previa',
        dependsOn: { key: 'v_applied_immigrant_visa', equals: 'Y' },
      },
      {
        key: 'v_applied_residence_in_us',
        type: 'radio',
        labelEs: '¿Habías pedido antes la residencia permanente estando dentro de Estados Unidos?',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
        ],
        defaultValue: 'N',
        real: { Y: 'pt4line5_yn_1', N: 'pt4line5_yn' },
      },
      {
        key: 'v_residence_rescinded',
        type: 'radio',
        labelEs: '¿Alguna vez tuviste la residencia permanente (green card) y te la quitaron después?',
        helpEs: 'Para casi todas las personas la respuesta es "No". Si no entiendes esta pregunta, déjala en "No" y consúltalo con tu abogado.',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
        ],
        defaultValue: 'N',
        real: { Y: 'pt4line6_yn_1', N: 'pt4line6_yn' },
      },
    ],
  },

  // ── 5. Tu trabajo y estudios ────────────────────────────────────────────
  {
    id: 5,
    titleEs: 'Tu trabajo y estudios',
    descriptionEs: 'Cuéntanos dónde has trabajado o estudiado en los últimos 5 años. Empieza por lo más reciente (tu trabajo o escuela de ahora). Si estuviste sin trabajar, también cuenta: pon quién te ayudaba con el dinero.',
    groups: {
      trabajo_actual: {
        title: 'Tu trabajo o escuela de ahora (o el más reciente)',
        description: 'Pon tu empleo o escuela actual. Si no trabajas ni estudias ahora, pon el último que tuviste. Si nunca has trabajado ni estudiado, deja todo vacío.',
        tone: 'plain',
      },
      trabajo_fuera: {
        title: 'Tu último trabajo o escuela fuera de Estados Unidos',
        description: 'Solo si tuviste un trabajo o escuela fuera de EE.UU. que no pusiste arriba. Si no aplica, déjalo vacío.',
        tone: 'plain',
      },
    },
    fields: [
      {
        key: 'pt4line7_employername_2',
        labelEs: 'Nombre del empleador, empresa o escuela',
        helpEs: 'El nombre del lugar donde trabajas o estudias.',
        groupKey: 'trabajo_actual',
      },
      {
        key: 'pt4line7_employername_1',
        labelEs: 'Tu ocupación o puesto',
        helpEs: 'A qué te dedicas ahí. Si no trabajas ni estudias, escribe "desempleado" o "estudiante".',
        groupKey: 'trabajo_actual',
      },
      {
        key: 'part4line7_streetname',
        labelEs: 'Calle y número del trabajo o escuela',
        groupKey: 'trabajo_actual',
      },
      {
        key: 'p4line7_number',
        labelEs: 'Número de apartamento, suite o piso (si aplica)',
        groupKey: 'trabajo_actual',
      },
      {
        key: 'p4line7_city',
        labelEs: 'Ciudad',
        groupKey: 'trabajo_actual',
      },
      {
        key: 'p4line7_state',
        labelEs: 'Estado',
        groupKey: 'trabajo_actual',
      },
      {
        key: 'p4line7_zipcode',
        labelEs: 'Código postal (ZIP)',
        groupKey: 'trabajo_actual',
      },
      {
        key: 'p4line7_province',
        labelEs: 'Provincia (si es fuera de EE.UU.)',
        groupKey: 'trabajo_actual',
      },
      {
        key: 'p4line7_postalcode',
        labelEs: 'Código postal (si es fuera de EE.UU.)',
        groupKey: 'trabajo_actual',
      },
      {
        key: 'p4line7_country',
        labelEs: 'País',
        groupKey: 'trabajo_actual',
      },
      {
        key: 'pt4line7_datefrom',
        labelEs: 'Fecha en que empezaste',
        helpEs: 'Escríbela como mes/día/año. Ejemplo: 06/01/2022.',
        groupKey: 'trabajo_actual',
      },
      {
        key: 'pt4line7_dateto',
        labelEs: 'Fecha en que terminaste',
        helpEs: 'Si todavía sigues ahí, escribe "PRESENTE".',
        groupKey: 'trabajo_actual',
      },
      {
        key: 'part4line7_streetname_1',
        labelEs: 'Si no trabajabas, ¿quién te apoyaba con el dinero?',
        helpEs: 'Por ejemplo: mis papás, un familiar, mi pareja. Solo si estuviste sin trabajar.',
        groupKey: 'trabajo_actual',
      },
      {
        key: 'pt4line8_employername',
        labelEs: 'Nombre del empleador, empresa o escuela',
        groupKey: 'trabajo_fuera',
      },
      {
        key: 'pt4line8_occupation',
        labelEs: 'Tu ocupación o puesto',
        helpEs: 'Si no trabajabas ni estudiabas, escríbelo así.',
        groupKey: 'trabajo_fuera',
      },
      {
        key: 'p4line8_streetname',
        labelEs: 'Calle y número',
        groupKey: 'trabajo_fuera',
      },
      {
        key: 'p4line8_number',
        labelEs: 'Número de apartamento, suite o piso (si aplica)',
        groupKey: 'trabajo_fuera',
      },
      {
        key: 'p4line8_city',
        labelEs: 'Ciudad',
        groupKey: 'trabajo_fuera',
      },
      {
        key: 'p4line8_state',
        labelEs: 'Estado (si es en EE.UU.)',
        groupKey: 'trabajo_fuera',
      },
      {
        key: 'p4line8_zipcode',
        labelEs: 'Código postal (ZIP, si es en EE.UU.)',
        groupKey: 'trabajo_fuera',
      },
      {
        key: 'p4line8_country',
        labelEs: 'País',
        groupKey: 'trabajo_fuera',
      },
      {
        key: 'pt4line8_datefrom',
        labelEs: 'Fecha en que empezaste',
        helpEs: 'Escríbela como mes/día/año.',
        groupKey: 'trabajo_fuera',
      },
      {
        key: 'pt4line8_dateto',
        labelEs: 'Fecha en que terminaste',
        groupKey: 'trabajo_fuera',
      },
      {
        key: 'part4line8_streetname',
        labelEs: 'Si no trabajabas, ¿quién te apoyaba con el dinero?',
        helpEs: 'Solo si estuviste sin trabajar en ese periodo.',
        groupKey: 'trabajo_fuera',
      },
    ],
  },

  // ── 6. Tus papás ────────────────────────────────────────────────────────
  {
    id: 6,
    titleEs: 'Tus papás',
    descriptionEs: 'Datos de tu papá y tu mamá (o las dos personas que aparecen como tus padres). Pon lo que sepas. Si no conoces algún dato, déjalo vacío; no pasa nada.',
    groups: {
      papa_1: {
        title: 'Tu primer papá o mamá',
        description: 'Aquí va uno de tus padres. No importa el orden. Pon lo que sepas; si no conoces un dato, déjalo vacío.',
        tone: 'plain',
      },
      papa_2: {
        title: 'Tu segundo papá o mamá',
        description: 'Aquí va el otro de tus padres. Si solo conoces a uno, puedes dejar esta parte vacía.',
        tone: 'plain',
      },
    },
    fields: [
      {
        key: 'pt5line1_familyname',
        labelEs: 'Apellidos',
        groupKey: 'papa_1',
      },
      {
        key: 'pt5line1_givenname',
        labelEs: 'Primer nombre',
        groupKey: 'papa_1',
      },
      {
        key: 'pt5line1_middlename',
        labelEs: 'Segundo nombre (si tiene)',
        groupKey: 'papa_1',
      },
      {
        key: 'pt5line2_familyname',
        labelEs: 'Apellidos al nacer (si eran distintos)',
        helpEs: 'Por ejemplo, el apellido de soltera de tu mamá. Si era el mismo, déjalo vacío.',
        groupKey: 'papa_1',
      },
      {
        key: 'pt5line2_givenname',
        labelEs: 'Nombre al nacer (si era distinto)',
        groupKey: 'papa_1',
      },
      {
        key: 'pt5line2_middlename',
        labelEs: 'Segundo nombre al nacer (si era distinto)',
        groupKey: 'papa_1',
      },
      {
        key: 'pt5line3_dateofbirth',
        labelEs: 'Fecha de nacimiento',
        helpEs: 'Escríbela como mes/día/año. Si no la sabes con certeza, déjala vacía.',
        groupKey: 'papa_1',
      },
      {
        key: 'pt5line5_citytownofbirth',
        labelEs: 'País donde nació',
        groupKey: 'papa_1',
      },
      {
        key: 'pt5line6_familyname',
        labelEs: 'Apellidos',
        groupKey: 'papa_2',
      },
      {
        key: 'pt5line6_givenname',
        labelEs: 'Primer nombre',
        groupKey: 'papa_2',
      },
      {
        key: 'pt5line6_middlename',
        labelEs: 'Segundo nombre (si tiene)',
        groupKey: 'papa_2',
      },
      {
        key: 'pt5line7_familyname',
        labelEs: 'Apellidos al nacer (si eran distintos)',
        helpEs: 'Por ejemplo, el apellido de soltera de tu mamá. Si era el mismo, déjalo vacío.',
        groupKey: 'papa_2',
      },
      {
        key: 'pt5line7_givenname',
        labelEs: 'Nombre al nacer (si era distinto)',
        groupKey: 'papa_2',
      },
      {
        key: 'pt5line7_middlename',
        labelEs: 'Segundo nombre al nacer (si era distinto)',
        groupKey: 'papa_2',
      },
      {
        key: 'pt5line8_dateofbirth',
        labelEs: 'Fecha de nacimiento',
        helpEs: 'Escríbela como mes/día/año. Si no la sabes con certeza, déjala vacía.',
        groupKey: 'papa_2',
      },
      {
        key: 'pt5line10_citytownofbirth',
        labelEs: 'País donde nació',
        groupKey: 'papa_2',
      },
    ],
  },

  // ── 7. Tu estado civil ──────────────────────────────────────────────────
  {
    id: 7,
    titleEs: 'Tu estado civil',
    descriptionEs: 'Dinos si estás soltero(a), casado(a) o en otra situación. Si estás casado(a), te pediremos los datos de tu pareja.',
    groups: {
      conyuge_actual: {
        title: 'Datos de tu pareja (cónyuge) actual',
        description: 'Solo si estás casado(a) o separado(a) legalmente. Pon lo que sepas.',
        tone: 'plain',
      },
      matrimonio_anterior: {
        title: 'Si estuviste casado(a) antes',
        description: 'Datos de tu pareja anterior. Solo si ya te habías casado antes. Si solo te has casado una vez (o ninguna), deja esto vacío.',
        tone: 'plain',
      },
    },
    fields: [
      {
        key: 'v_marital',
        type: 'select',
        labelEs: '¿Cuál es tu estado civil ahora?',
        options: [
          { value: 'soltero', labelEs: 'Soltero(a) (nunca me he casado)' },
          { value: 'casado', labelEs: 'Casado(a)' },
          { value: 'divorciado', labelEs: 'Divorciado(a)' },
          { value: 'viudo', labelEs: 'Viudo(a)' },
          { value: 'anulado', labelEs: 'Mi matrimonio fue anulado' },
          { value: 'separado', labelEs: 'Separado(a) legalmente' },
        ],
        defaultValue: 'soltero',
        real: {
          soltero: 'pt6line1_maritalstatus_1',
          casado: 'pt6line1_maritalstatus_3',
          divorciado: 'pt6line1_maritalstatus',
          viudo: 'pt6line1_maritalstatus_2',
          anulado: 'pt6line1_maritalstatus_4',
          separado: 'pt6line1_maritalstatus_5',
        },
      },
      {
        key: 'pt6line3_timesmarried',
        labelEs: '¿Cuántas veces te has casado en total?',
        helpEs: 'Cuenta también el matrimonio de ahora y los matrimonios que fueron anulados. Si nunca te has casado, escribe 0.',
      },
      {
        key: 'pt6line4_familyname',
        labelEs: 'Apellidos de tu pareja',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'pt6line4_givenname',
        labelEs: 'Primer nombre de tu pareja',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'pt6line4_middlename',
        labelEs: 'Segundo nombre de tu pareja (si tiene)',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'pt6line5_aliennumber',
        labelEs: 'Número de extranjero (A-Number) de tu pareja, si tiene',
        helpEs: 'Es un número de 9 dígitos. Si no tiene o no lo sabes, déjalo vacío.',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'pt5line8_dateofbirth_1',
        labelEs: 'Fecha de nacimiento de tu pareja',
        helpEs: 'Escríbela como mes/día/año.',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'pt6line7_country',
        labelEs: 'País donde nació tu pareja',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'v_spouse_military',
        type: 'radio',
        labelEs: '¿Tu pareja es ahora miembro del ejército o de la Guardia Costera de EE.UU.?',
        helpEs: 'Solo si estás casado(a). Si no aplica, deja "No aplica".',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
          { value: 'A', labelEs: 'No aplica' },
        ],
        defaultValue: 'A',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
        real: { Y: 'pt5line2_ynna_1', N: 'pt5line2_ynna', A: 'pt5line2_ynna_2' },
      },
      {
        key: 'part6line8_streetname',
        labelEs: 'Dirección de tu pareja: calle y número',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'p6line8_city',
        labelEs: 'Ciudad donde vive tu pareja',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'p6line8_province',
        labelEs: 'Provincia (si es fuera de EE.UU.)',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'p6line8_postalcode',
        labelEs: 'Código postal',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'p6line8_country',
        labelEs: 'País donde vive tu pareja',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'pt6line10_citytownofbirth',
        labelEs: '¿En qué ciudad se casaron?',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'pt6line10_state',
        labelEs: 'Estado o provincia donde se casaron',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'pt6line10_country',
        labelEs: 'País donde se casaron',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'pt5line8_dateofbirth_2',
        labelEs: 'Fecha en que se casaron',
        helpEs: 'Escríbela como mes/día/año.',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
      },
      {
        key: 'v_spouse_applying',
        type: 'radio',
        labelEs: '¿Tu pareja está pidiendo la residencia junto contigo?',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
        ],
        defaultValue: 'N',
        groupKey: 'conyuge_actual',
        dependsOn: { key: 'v_marital', equals: ['casado', 'separado'] },
        real: { Y: 'pt6line11_yn_1', N: 'pt6line11_yn' },
      },
      {
        key: 'pt6line12_familyname',
        labelEs: 'Apellidos de tu pareja anterior',
        helpEs: 'El apellido que usaba antes de casarse contigo.',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
      },
      {
        key: 'pt6line12_givenname',
        labelEs: 'Primer nombre de tu pareja anterior',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
      },
      {
        key: 'pt6line12_middlename',
        labelEs: 'Segundo nombre de tu pareja anterior (si tiene)',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
      },
      {
        key: 'pt5line8_dateofbirth_3',
        labelEs: 'Fecha de nacimiento de tu pareja anterior',
        helpEs: 'Escríbela como mes/día/año.',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
      },
      {
        key: 'pt6line14_country',
        labelEs: 'País donde nació tu pareja anterior',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
      },
      {
        key: 'pt6line15_country',
        labelEs: 'País del que es ciudadano tu pareja anterior',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
      },
      {
        key: 'pt6line16_dateofbirth',
        labelEs: 'Fecha en que te casaste con tu pareja anterior',
        helpEs: 'Escríbela como mes/día/año.',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
      },
      {
        key: 'pt6line10_citytownofbirth_1',
        labelEs: 'Ciudad donde te casaste con tu pareja anterior',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
      },
      {
        key: 'pt6line10_state_1',
        labelEs: 'Estado o provincia donde te casaste',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
      },
      {
        key: 'pt6line10_country_1',
        labelEs: 'País donde te casaste',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
      },
      {
        key: 'pt6line18_citytownofbirth',
        labelEs: 'Ciudad donde terminó ese matrimonio',
        helpEs: 'Donde se hizo el divorcio, la anulación, etc.',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
      },
      {
        key: 'pt6line18_state',
        labelEs: 'Estado o provincia donde terminó ese matrimonio',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
      },
      {
        key: 'pt6line18_country',
        labelEs: 'País donde terminó ese matrimonio',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
      },
      {
        key: 'pt6line16_dateofbirth_1',
        labelEs: 'Fecha en que terminó ese matrimonio',
        helpEs: 'Escríbela como mes/día/año.',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
      },
      {
        key: 'v_prior_marriage_ended',
        type: 'radio',
        labelEs: '¿Cómo terminó ese matrimonio anterior?',
        options: [
          { value: 'divorcio', labelEs: 'Por divorcio' },
          { value: 'fallecio', labelEs: 'Mi pareja falleció' },
          { value: 'anulado', labelEs: 'Fue anulado' },
          { value: 'otro', labelEs: 'Otro (explícalo abajo)' },
        ],
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_marital', equals: ['casado', 'divorciado', 'viudo', 'anulado', 'separado'] },
        real: {
          divorcio: 'pt6line19_maritalstatus_3',
          fallecio: 'pt6line19_maritalstatus',
          anulado: 'pt6line19_maritalstatus_1',
          otro: 'pt6line19_maritalstatus_2',
        },
      },
      {
        key: 'pt6line19_howmarriageendedother',
        labelEs: 'Si elegiste "Otro", explica cómo terminó',
        groupKey: 'matrimonio_anterior',
        dependsOn: { key: 'v_prior_marriage_ended', equals: 'otro' },
      },
    ],
  },

  // ── 8. Tus hijos ──────────────────────────────────────────────────────────
  {
    id: 8,
    titleEs: 'Tus hijos',
    descriptionEs: 'Cuéntanos cuántos hijos tienes y sus datos. Cuentan todos tus hijos vivos, de cualquier edad, estén donde estén: hijos biológicos, adoptados o hijastros, casados o solteros. Si no tienes hijos, escribe 0 y listo.',
    groups: {
      hijo_1: {
        title: 'Tu primer hijo',
        description: 'Datos de uno de tus hijos. Pon lo que sepas.',
        tone: 'plain',
      },
      hijo_2: {
        title: 'Tu segundo hijo',
        description: 'Datos de otro hijo. Solo si tienes más de uno.',
        tone: 'plain',
      },
    },
    fields: [
      {
        key: 'pt6line1_totalchildren',
        labelEs: '¿Cuántos hijos tienes en total?',
        helpEs: 'Cuenta a todos tus hijos vivos, sin importar la edad ni dónde vivan. Si no tienes hijos, escribe 0.',
        defaultValue: '0',
      },
      {
        key: 'pt7line2_familyname',
        labelEs: 'Apellidos del hijo',
        groupKey: 'hijo_1',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
      },
      {
        key: 'pt7line2_givenname',
        labelEs: 'Primer nombre del hijo',
        groupKey: 'hijo_1',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
      },
      {
        key: 'pt7line2_middlename',
        labelEs: 'Segundo nombre del hijo (si tiene)',
        groupKey: 'hijo_1',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
      },
      {
        key: 'pt7line2_aliennumber',
        labelEs: 'Número de extranjero (A-Number) del hijo, si tiene',
        helpEs: 'Es un número de 9 dígitos. Si no tiene o no lo sabes, déjalo vacío.',
        groupKey: 'hijo_1',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
      },
      {
        key: 'pt7line2_dateofbirth',
        labelEs: 'Fecha de nacimiento del hijo',
        helpEs: 'Escríbela como mes/día/año.',
        groupKey: 'hijo_1',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
      },
      {
        key: 'pt7line2_country',
        labelEs: 'País donde nació el hijo',
        groupKey: 'hijo_1',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
      },
      {
        key: 'pt7line2_relationship',
        labelEs: '¿Qué relación tiene contigo?',
        helpEs: 'Por ejemplo: hijo biológico, hijastro, hijo adoptado.',
        groupKey: 'hijo_1',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
      },
      {
        key: 'v_child1_applying',
        type: 'radio',
        labelEs: '¿Este hijo también está pidiendo la residencia con su propia solicitud I-485?',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
        ],
        defaultValue: 'N',
        groupKey: 'hijo_1',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
        real: { Y: 'pt7line2_yn_1', N: 'pt7line2_yn' },
      },
      {
        key: 'pt7line3_familyname',
        labelEs: 'Apellidos del hijo',
        groupKey: 'hijo_2',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['2', '3', '4', '5', '6', '7', '8', '9'] },
      },
      {
        key: 'pt7line3_givenname',
        labelEs: 'Primer nombre del hijo',
        groupKey: 'hijo_2',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['2', '3', '4', '5', '6', '7', '8', '9'] },
      },
      {
        key: 'pt7line3_middlename',
        labelEs: 'Segundo nombre del hijo (si tiene)',
        groupKey: 'hijo_2',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['2', '3', '4', '5', '6', '7', '8', '9'] },
      },
      {
        key: 'pt7line3_aliennumber',
        labelEs: 'Número de extranjero (A-Number) del hijo, si tiene',
        helpEs: 'Es un número de 9 dígitos. Si no tiene o no lo sabes, déjalo vacío.',
        groupKey: 'hijo_2',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['2', '3', '4', '5', '6', '7', '8', '9'] },
      },
      {
        key: 'pt7line3_dateofbirth',
        labelEs: 'Fecha de nacimiento del hijo',
        helpEs: 'Escríbela como mes/día/año.',
        groupKey: 'hijo_2',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['2', '3', '4', '5', '6', '7', '8', '9'] },
      },
      {
        key: 'pt7line3_country',
        labelEs: 'País donde nació el hijo',
        groupKey: 'hijo_2',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['2', '3', '4', '5', '6', '7', '8', '9'] },
      },
      {
        key: 'pt7line3_relationship',
        labelEs: '¿Qué relación tiene contigo?',
        helpEs: 'Por ejemplo: hijo biológico, hijastro, hijo adoptado.',
        groupKey: 'hijo_2',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['2', '3', '4', '5', '6', '7', '8', '9'] },
      },
      {
        key: 'v_child2_applying',
        type: 'radio',
        labelEs: '¿Este hijo también está pidiendo la residencia con su propia solicitud I-485?',
        options: [
          { value: 'Y', labelEs: 'Sí' },
          { value: 'N', labelEs: 'No' },
        ],
        defaultValue: 'N',
        groupKey: 'hijo_2',
        dependsOn: { key: 'pt6line1_totalchildren', equals: ['2', '3', '4', '5', '6', '7', '8', '9'] },
        real: { Y: 'pt7line3_yn_1', N: 'pt7line3_yn' },
      },
    ],
  }
]
