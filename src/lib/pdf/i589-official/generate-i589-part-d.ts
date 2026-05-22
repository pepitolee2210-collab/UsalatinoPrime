// Helpers para llenar la Parte D (firma del solicitante) del I-589.
//
// La política de USALatino Prime (consultar con abogado antes de GA) es:
//   - Q1 "Did your spouse, parent, or child help fill out the form?" = NO
//   - Q2 "Did someone OTHER than your spouse, parent, or child prepare this
//        application for you?" = NO
//     Razón: las respuestas reales vienen del cliente en el cuestionario
//     M1-M11 y se transcriben sin alteración. El sistema asiste con
//     formato/traducción pero no es preparer. El cliente firma.
//   - Q3 "Were you provided with a list of legal services?" = YES (en
//        onboarding mostramos los recursos pro bono que USCIS publica).
//   - Part E (Preparer) queda VACÍO porque la plataforma no se identifica.
//
// TODO(legal): validar Q2 = NO con abogado de inmigración licenciado
// antes de lanzar a producción. Si la consulta cambia la respuesta,
// editar solo este helper.

/**
 * Construye los valores fijos de Parte D que el sistema hardcodea por
 * política. Estos se mergean con el applicantFullName / phone / native
 * alphabet name calculados desde el perfil del cliente al generar el PDF
 * completo.
 */
export interface PartDInputs {
  applicantFullName: string
  applicantTelephone?: string | null
  /** Si el cliente vio la lista de pro-bono services en onboarding (default true). */
  receivedProBonoList?: boolean
}

export function buildPartDValues(input: PartDInputs): Record<string, string | boolean> {
  const fields: Record<string, string | boolean> = {}

  // Print Complete Name (Part D)
  fields['form1[0].#subform[10].TextField20[0]'] = input.applicantFullName
  // Native alphabet name — para español es el mismo nombre.
  fields['form1[0].#subform[10].TextField20[1]'] = input.applicantFullName

  // Q1: Spouse/parent/child helped — NO
  fields['form1[0].#subform[10].PtD_ckboxynd1[1]'] = true
  // Q2: Someone else prepared — NO (política, ver TODO arriba)
  fields['form1[0].#subform[10].ckboxynd2[1]'] = true
  // Q3: Got pro-bono list — YES si lo mostramos en onboarding (default true).
  if (input.receivedProBonoList !== false) {
    fields['form1[0].#subform[10].ckboxynd3[0]'] = true
  } else {
    fields['form1[0].#subform[10].ckboxynd3[1]'] = true
  }

  // Phone
  if (input.applicantTelephone) {
    fields['form1[0].#subform[10].TextField22[0]'] = input.applicantTelephone
  }

  // Part E: queda vacío intencionalmente — la plataforma no es preparer.

  return fields
}
