/**
 * Términos y Condiciones de Servicio y Descargo de Responsabilidad.
 *
 * FUENTE ÚNICA DE VERDAD del disclaimer firmable por el cliente. Consumido por:
 *  - la UI del portal (src/app/cita/[token]/_components/screens/terminos-screen.tsx)
 *  - el generador de PDF (src/lib/pdf/generate-terms-pdf.ts)
 *
 * Versionado: al cambiar el texto, incrementar TERMS_VERSION. Eso habilita una
 * nueva aceptación por caso (la idempotencia es por `(case_id, terms_version)`) y
 * conserva el historial de versiones aceptadas.
 *
 * AVISO LEGAL: este texto es un borrador sólido y fundamentado (USCIS, EOIR, FTC,
 * ESIGN/UETA), NO un documento legal final. DEBE ser revisado y aprobado por un
 * abogado con licencia en Utah antes de usarse en producción.
 */

export const TERMS_VERSION = '2026-06-v1'
export const COMPANY_NAME = 'USA Latino Prime'
export const GOVERNING_STATE = 'Utah'

export interface TermsTokens {
  clientName: string
  serviceName: string
  caseNumber: string
  acceptedDate: string
}

export interface TermsSection {
  id: string
  title: string
  paragraphs: string[]
}

/**
 * Reemplaza los placeholders del disclaimer. `{{companyName}}` se inyecta siempre
 * desde COMPANY_NAME; el resto provienen del contexto del caso.
 */
export function interpolate(text: string, tokens: TermsTokens): string {
  return text
    .replace(/\{\{companyName\}\}/g, COMPANY_NAME)
    .replace(/\{\{clientName\}\}/g, tokens.clientName?.trim() || '—')
    .replace(/\{\{serviceName\}\}/g, tokens.serviceName?.trim() || '—')
    .replace(/\{\{caseNumber\}\}/g, tokens.caseNumber?.trim() || '—')
    .replace(/\{\{acceptedDate\}\}/g, tokens.acceptedDate?.trim() || '—')
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: 'intro',
    title: 'Introducción — Por favor, lea esto con atención',
    paragraphs: [
      'Bienvenido(a). Este documento explica de forma clara y honesta qué hacemos y qué NO hacemos en {{companyName}}. Es muy importante que lo lea completo y lo entienda antes de aceptarlo y firmarlo electrónicamente, porque define la relación entre usted y nuestra empresa.',
      'Lo resumimos en una sola idea fundamental: NO somos abogados, NO somos un bufete de abogados y NO le damos asesoría legal. Somos una empresa que le ayuda con tareas administrativas: organizar y preparar sus documentos, traducir, y guiarlo(a) para que usted use nuestra plataforma en línea y complete sus propios trámites. Usted es siempre la persona responsable de la información que proporciona y de su propio caso ante el gobierno.',
      'Si en algún momento algo de este documento no le queda claro, deténgase, pregúntenos y, sobre todo, considere consultar con un abogado de inmigración con licencia antes de continuar. Aceptar estos términos es voluntario.',
    ],
  },
  {
    id: 'naturaleza-servicio',
    title: '1. Naturaleza de nuestro servicio (NO somos abogados)',
    paragraphs: [
      '{{companyName}} NO es un bufete de abogados ni una firma legal, y ninguno de sus dueños, empleados, representantes o colaboradores es abogado (a menos que se identifique expresamente y por escrito lo contrario en su caso particular).',
      'No existe ni se crea una relación abogado-cliente entre usted y {{companyName}} por el hecho de contratar nuestros servicios, usar nuestra plataforma, comunicarse con nuestro personal o aceptar este documento.',
      'No lo representamos legalmente ante el Servicio de Ciudadanía e Inmigración de Estados Unidos (USCIS), ante la Oficina Ejecutiva de Revisión de Casos de Inmigración (EOIR), ante los tribunales de inmigración, ante el Departamento de Seguridad Nacional (DHS), ni ante ninguna corte o agencia estatal o federal. La única forma en que un no-abogado puede representar legalmente a una persona en asuntos de inmigración es a través de un representante acreditado reconocido por el Departamento de Justicia de EE. UU. (programa de Reconocimiento y Acreditación de EOIR). Salvo que se le informe expresamente y por escrito que su caso es atendido por un representante acreditado bajo dicho programa, ninguna persona de nuestra empresa actúa como su representante legal.',
      'En Estados Unidos, la palabra notario o notario público NO significa abogado. Un notary public estadounidense solo está autorizado a presenciar firmas y administrar juramentos; no puede dar asesoría legal de inmigración. {{companyName}} no se anuncia ni opera como notario para asuntos migratorios y nunca debe entenderse como tal.',
    ],
  },
  {
    id: 'no-asesoria-legal',
    title: '2. No brindamos asesoría legal',
    paragraphs: [
      'Toda la información que le proporcionamos, ya sea verbal, escrita, por nuestra plataforma, por mensajes o por cualquier medio, tiene únicamente fines de asistencia administrativa, organización, preparación clerical de documentos y traducción. Nada de lo que decimos o hacemos constituye asesoría legal, opinión legal, estrategia legal ni recomendación sobre qué hacer en su caso migratorio.',
      'No seleccionamos por usted qué formularios necesita, no decidimos su elegibilidad para ningún beneficio migratorio, no le decimos cómo debe responder las preguntas de un formulario en cuanto a su contenido legal, ni evaluamos los méritos de su caso. Esas son decisiones que corresponden a usted o a un abogado con licencia. Nosotros transcribimos, organizamos y preparamos la información que usted nos proporciona y dirige.',
      'Le recomendamos enfáticamente consultar con un abogado de inmigración con licencia, independiente de nuestra empresa, especialmente si su caso es complejo, si tiene antecedentes penales, órdenes de deportación, plazos vencidos, o cualquier duda sobre sus derechos u opciones legales. Solo un abogado o un representante acreditado por el Departamento de Justicia está autorizado a darle asesoría legal de inmigración.',
      'Nuestros servicios pueden incluir apoyo con: Visa Juvenil (Estatus Especial de Inmigrante Juvenil / SIJS), Asilo Político (incluido el proceso de miedo creíble), Cambio de Corte o Cambio de Sede (formulario EOIR-33), Cambio o Ajuste de Estatus, Mociones, Apelaciones, Taxes (impuestos), ITIN y trámites relacionados con la Licencia de Conducir. En todos estos casos, nuestra labor es exclusivamente administrativa y de preparación de documentos según la información que usted aporta; no constituye representación ni asesoría legal.',
    ],
  },
  {
    id: 'responsabilidad-cliente',
    title: '3. Su responsabilidad: veracidad y exactitud de la información',
    paragraphs: [
      'Usted es el único responsable de la veracidad, exactitud e integridad de TODA la información, datos y documentos que nos proporciona. Nosotros preparamos los documentos basándonos exclusivamente en lo que usted nos entrega; no verificamos, investigamos ni garantizamos que su información sea verdadera o correcta.',
      'Usted es responsable de revisar cuidadosamente cada documento y formulario antes de firmarlo o presentarlo, para confirmar que la información sea correcta y esté completa, y de corregir cualquier error u omisión. Al firmar un formulario, usted declara ante el gobierno que su contenido es verdadero.',
      'Proporcionar información falsa, incompleta o engañosa al gobierno de Estados Unidos puede tener consecuencias graves, que pueden incluir la negación de su trámite, multas, deportación, prohibiciones de reingreso e incluso responsabilidad penal. {{companyName}} no aconseja, no induce y no participa de ninguna manera en la presentación de información falsa, y no es responsable de las consecuencias de información inexacta o falsa que usted proporcione.',
      'Nunca firme formularios en blanco ni documentos que contengan información que usted sepa que es falsa. Si alguien le pide hacerlo, no lo haga.',
    ],
  },
  {
    id: 'sin-garantia',
    title: '4. Sin garantía de resultados',
    paragraphs: [
      '{{companyName}} NO garantiza ningún resultado. No garantizamos la aprobación, el otorgamiento, la concesión ni el éxito de ningún trámite, petición, solicitud, beneficio o caso migratorio o de cualquier otra naturaleza.',
      'No garantizamos tiempos de procesamiento. Los plazos los determinan exclusivamente las autoridades correspondientes y están fuera de nuestro control.',
      'Todas las decisiones sobre su caso las toman de manera independiente USCIS, EOIR, los tribunales y las demás autoridades gubernamentales, conforme a sus propias leyes, reglas y criterios. La negación, demora o cualquier acción adversa de cualquier autoridad sobre {{serviceName}} no es responsabilidad de {{companyName}} ni constituye motivo de reembolso, salvo lo que disponga su contrato de servicio.',
    ],
  },
  {
    id: 'tarifas',
    title: '5. Tarifas y pagos (separados de las tasas del gobierno)',
    paragraphs: [
      'Los honorarios que usted nos paga por nuestros servicios son completamente SEPARADOS e independientes de las tasas o cuotas oficiales del gobierno (por ejemplo, las tasas de presentación de USCIS o de las cortes). Nuestros honorarios cubren únicamente nuestro trabajo administrativo y de preparación; no incluyen las tasas gubernamentales, salvo que se indique expresamente por escrito.',
      'Muchos formularios oficiales del gobierno son gratuitos y pueden obtenerse directamente y sin costo en los sitios web oficiales (por ejemplo, uscis.gov). Usted paga a {{companyName}} por el servicio de asistencia, organización y preparación, no por los formularios en sí.',
      'Los precios, las condiciones de pago, las políticas de reembolso y de cancelación se rigen por su Contrato de Servicio firmado por separado. En caso de cualquier diferencia sobre precios o pagos, prevalece dicho Contrato de Servicio. Este documento de Términos y Condiciones complementa, pero no reemplaza, ese contrato.',
    ],
  },
  {
    id: 'derecho-abogado',
    title: '6. Su derecho a contratar un abogado',
    paragraphs: [
      'Usted tiene derecho a contratar a un abogado con licencia en cualquier momento, antes, durante o después de usar nuestros servicios. Nada de lo aquí establecido limita ese derecho.',
      'Lo alentamos a buscar asesoría de un abogado de inmigración independiente, en especial para asuntos complejos o cuando estén en juego decisiones importantes sobre su caso. Usted puede encontrar proveedores de servicios legales autorizados (abogados y representantes acreditados) a través de recursos oficiales como USCIS (uscis.gov/avoid-scams) y EOIR (Departamento de Justicia).',
    ],
  },
  {
    id: 'uso-plataforma',
    title: '7. Uso de la plataforma en línea',
    paragraphs: [
      'El papel principal de {{companyName}} es guiarlo(a) en el uso de nuestra plataforma en línea y ayudarlo(a) a organizar y preparar sus documentos. La plataforma es una herramienta que usted utiliza para gestionar su propio trámite.',
      'Usted es responsable de mantener la confidencialidad y seguridad de las credenciales de su cuenta (usuario y contraseña) y de toda la actividad que ocurra bajo su cuenta. Notifíquenos de inmediato si sospecha de un uso no autorizado.',
      'La plataforma se ofrece tal cual y según disponibilidad. Podemos realizar mantenimiento, actualizaciones o experimentar interrupciones técnicas. No garantizamos disponibilidad continua, ininterrumpida o libre de errores, y no somos responsables por fallas técnicas, de internet o de terceros ajenas a nuestro control razonable.',
      'Usted se compromete a usar la plataforma únicamente para fines lícitos y conforme a estos términos, y a no proporcionar información que no sea verdadera y propia.',
    ],
  },
  {
    id: 'confidencialidad-datos',
    title: '8. Confidencialidad y manejo de datos personales',
    paragraphs: [
      '{{companyName}} trata su información personal sensible (PII) de manera confidencial y aplica medidas razonables, administrativas y técnicas, para protegerla contra acceso, uso o divulgación no autorizados.',
      'Usamos y compartimos su información únicamente en la medida necesaria para prestarle el servicio contratado (por ejemplo, para preparar y, cuando usted lo autorice, presentar sus formularios), para operar la plataforma, o cuando la ley lo exija o lo permita (por ejemplo, ante una orden judicial o requerimiento gubernamental válido).',
      'No vendemos su información personal. No la divulgamos a terceros con fines de mercadeo sin su consentimiento. Conservamos sus documentos y registros durante el tiempo necesario para el servicio y según lo requiera la ley.',
      'Para más detalles sobre cómo recopilamos, usamos, almacenamos y protegemos su información, consulte nuestra Política de Privacidad, si está disponible, la cual se considera parte integral de esta relación.',
    ],
  },
  {
    id: 'firma-electronica',
    title: '9. Firma electrónica y consentimiento (ESIGN / UETA)',
    paragraphs: [
      'Usted consiente expresamente en realizar esta transacción por medios electrónicos y en firmar, aceptar y recibir este documento, su Contrato de Servicio y demás documentos relacionados de forma electrónica.',
      'Usted reconoce que su firma electrónica, incluida una firma dibujada o trazada en pantalla, una marca de aceptación, o un clic de Acepto, tiene la misma validez y efecto legal que una firma manuscrita en papel, de conformidad con la Ley federal de Firmas Electrónicas en el Comercio Global y Nacional (ESIGN Act) y la Ley Uniforme de Transacciones Electrónicas (UETA) adoptada por los estados.',
      'Usted tiene derecho a solicitar una copia en papel de este documento y de los documentos relacionados, y a retirar su consentimiento para usar medios electrónicos. Si retira su consentimiento, es posible que no podamos continuar prestándole el servicio por medios electrónicos. Para solicitar copias en papel o retirar su consentimiento, contáctenos por los medios oficiales de la empresa.',
      'Para conservar y acceder a los registros electrónicos, usted necesita un dispositivo con acceso a internet, un navegador actualizado y la capacidad de ver y guardar archivos en formato PDF. Al continuar, confirma que cuenta con estos medios.',
      'Usted acepta que, como evidencia de su firma y aceptación, registremos y conservemos datos asociados, tales como la fecha y hora ({{acceptedDate}}), la dirección IP, el identificador de su cuenta y la versión del documento aceptado. Usted reconoce que estos registros pueden usarse como prueba de su consentimiento y aceptación.',
    ],
  },
  {
    id: 'limitacion-responsabilidad',
    title: '10. Limitación de responsabilidad e indemnización',
    paragraphs: [
      'En la máxima medida permitida por la ley aplicable, {{companyName}}, sus dueños, empleados, representantes y colaboradores no serán responsables por daños indirectos, incidentales, especiales, consecuentes o punitivos, ni por pérdida de oportunidades, derivados de o relacionados con nuestros servicios, la plataforma, o cualquier acción u omisión de una autoridad gubernamental sobre su caso.',
      'En la máxima medida permitida por la ley, la responsabilidad total de {{companyName}} por cualquier reclamo relacionado con los servicios no excederá el monto de los honorarios que usted efectivamente nos pagó por el servicio específico que dio origen al reclamo.',
      'Usted acepta indemnizar y mantener libre de responsabilidad a {{companyName}} frente a cualquier reclamo, pérdida, daño, multa o gasto (incluidos honorarios razonables de abogados) que surja de: (a) información falsa, inexacta o incompleta que usted haya proporcionado; (b) el incumplimiento de estos términos por su parte; o (c) el uso indebido de la plataforma o de los documentos preparados.',
      'Nada en este documento pretende excluir o limitar responsabilidades que, conforme a la ley aplicable, no puedan ser excluidas o limitadas.',
    ],
  },
  {
    id: 'idioma',
    title: '11. Idioma de los servicios',
    paragraphs: [
      'Nuestros servicios y comunicaciones se brindan en español, para su comodidad y comprensión. Usted declara que entiende el idioma español y que ha leído y comprendido el contenido de este documento.',
      'Si se le proporciona una traducción de este documento a otro idioma como cortesía, la versión en español será la versión controladora en caso de cualquier diferencia de interpretación, salvo que la ley aplicable disponga lo contrario.',
    ],
  },
  {
    id: 'integridad-antifraude',
    title: '12. Integridad migratoria y prevención de fraude',
    paragraphs: [
      '{{companyName}} está comprometida con la integridad y la legalidad. No aconsejamos, no fomentamos, no asistimos ni participamos en la presentación de información, declaraciones o documentos falsos o fraudulentos ante ninguna autoridad.',
      'Usted es el único responsable ante el gobierno por la veracidad de su solicitud y de toda la información presentada. Si descubrimos que se nos ha solicitado preparar documentos con información que sabemos o creemos razonablemente que es falsa, nos reservamos el derecho de negarnos a continuar con el servicio y de dar por terminada la relación, sin que ello genere responsabilidad para nosotros.',
    ],
  },
  {
    id: 'general',
    title: '13. Aceptación voluntaria, ley aplicable y disposiciones generales',
    paragraphs: [
      'Usted declara que es mayor de edad (o cuenta con la capacidad legal y la autorización necesaria) y que acepta estos términos de manera libre, voluntaria e informada, sin que medie presión, coacción ni promesa de resultados.',
      'Usted declara que ha leído, entendido y aceptado en su totalidad este documento.',
      'Ley aplicable: este documento se rige e interpreta conforme a las leyes del Estado de Utah y de los Estados Unidos de América, sin atender a sus normas sobre conflicto de leyes.',
      'Divisibilidad (severability): si alguna disposición de este documento se considera inválida o inejecutable, las demás disposiciones permanecerán en pleno vigor y efecto, y la disposición afectada se interpretará en la medida más cercana posible a la intención original dentro de lo permitido por la ley.',
      'Acuerdo complementario: este documento complementa y no reemplaza su Contrato de Servicio. En caso de conflicto específico sobre honorarios, alcance del servicio, pagos o reembolsos, prevalece el Contrato de Servicio. En todo lo relativo a la naturaleza no-legal del servicio y a los descargos de responsabilidad, prevalece este documento.',
      'Modificaciones: {{companyName}} puede actualizar estos términos. La versión vigente al momento de su aceptación es la que rige su relación, identificada por su número de versión y fecha.',
    ],
  },
  {
    id: 'reconocimiento-aceptacion',
    title: 'Reconocimiento y aceptación del cliente',
    paragraphs: [
      'Yo, {{clientName}}, declaro y reconozco lo siguiente:',
      'He leído y entendido completamente este documento de Términos y Condiciones de Servicio y Descargo de Responsabilidad. Entiendo que {{companyName}} NO es un bufete de abogados, que su personal NO son abogados, que NO recibo asesoría legal y que NO existe una relación abogado-cliente. Entiendo que la empresa únicamente me asiste con tareas administrativas, de organización, de preparación de documentos, de traducción y de uso de la plataforma, con base en la información que yo proporciono.',
      'Entiendo que soy el único responsable de la veracidad y exactitud de toda la información y documentos que entrego, y de revisar cada documento antes de firmarlo o presentarlo. Entiendo que no se me garantiza ningún resultado y que todas las decisiones sobre mi caso ({{serviceName}}, número de caso {{caseNumber}}) las toman de forma independiente las autoridades como USCIS y EOIR.',
      'Entiendo que tengo derecho a contratar a un abogado con licencia en cualquier momento y que se me recomienda hacerlo para asuntos complejos. Acepto firmar electrónicamente y reconozco que mi firma electrónica tiene plena validez legal conforme a las leyes ESIGN y UETA.',
      'Acepto estos términos de manera libre, voluntaria e informada, en idioma español, el día {{acceptedDate}}.',
    ],
  },
]
