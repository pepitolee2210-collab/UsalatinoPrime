interface ContractData {
  service_name: string
  client_full_name: string
  client_passport: string
  client_dob: string
  minors: any[]
  objeto_del_contrato: string
  etapas: string[]
  addon_services: any[]
  total_price: number
  initial_payment: number
  has_installments: boolean
  installment_count: number
  payment_schedule: any[]
}

function formatDateSpanish(dateStr: string): string {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  const d = new Date(dateStr + 'T12:00:00')
  if (isNaN(d.getTime())) return dateStr
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`
}

function todaySpanish(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return formatDateSpanish(`${yyyy}-${mm}-${dd}`)
}

export function ContractHTMLViewer({ contract }: { contract: ContractData }) {
  const {
    service_name, client_full_name, client_passport, client_dob,
    minors, objeto_del_contrato, etapas, addon_services,
    total_price, initial_payment, has_installments, installment_count, payment_schedule,
  } = contract

  const allServiceNames = addon_services?.length > 0
    ? `${service_name.toUpperCase()} + ${addon_services.map((a: any) => a.name.toUpperCase()).join(' + ')}`
    : service_name.toUpperCase()

  const remaining = initial_payment ? total_price - initial_payment : total_price
  const monthly = installment_count > 0 ? Math.round(remaining / installment_count) : 0

  return (
    <div className="bg-white text-gray-800 font-sans text-sm leading-relaxed">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002855]">UsaLatinoPrime</h1>
        <div className="h-1 bg-[#F2A900] mt-2 rounded" />
      </div>

      <h2 className="text-center text-lg font-bold text-[#002855] mb-1">
        CONTRATO DE PRESTACI&Oacute;N DE SERVICIOS
      </h2>
      <p className="text-center text-base font-semibold text-[#002855] mb-4">{allServiceNames}</p>
      <p className="text-gray-500 mb-6">Fecha: {todaySpanish()}</p>

      {/* Partes del contrato */}
      <Section title="PARTES DEL CONTRATO">
        <p className="font-semibold text-[#002855] mb-2">EL CONSULTOR:</p>
        <Field label="Empresa" value="USA LATINO PRIME" />
        <Field label="Representante" value="Jimy Henry Orellana Dom&iacute;nguez" />
        <Field label="Tel&eacute;fono" value="801-941-3479" />
        <Field label="Zelle" value="Henryorellana@usalatinoprime.com" />

        <p className="font-semibold text-[#002855] mt-4 mb-2">EL CLIENTE:</p>
        <Field label="Nombre completo" value={client_full_name} />
        <Field label="Pasaporte" value={client_passport} />
        <Field label="Fecha de nacimiento" value={client_dob ? formatDateSpanish(client_dob) : ''} />

        {minors?.length > 0 && (
          <div className="mt-4">
            <p className="font-semibold text-[#002855] mb-2">
              {minors.length === 1 ? 'MENOR BENEFICIARIO/A:' : 'MENORES BENEFICIARIOS/AS:'}
            </p>
            {minors.map((minor: any, i: number) => (
              <div key={i} className="ml-3 mb-2">
                {minors.length > 1 && <p className="text-xs font-semibold text-gray-500">Hijo/a #{i + 1}:</p>}
                <Field label="Nombre completo" value={minor.fullName} />
                {minor.dob && <Field label="Fecha de nacimiento" value={formatDateSpanish(minor.dob)} />}
                {minor.birthplace && <Field label="Lugar de nacimiento" value={minor.birthplace} />}
                {minor.passport && <Field label="Pasaporte" value={minor.passport} />}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Objeto del contrato */}
      <Section title="OBJETO DEL CONTRATO">
        <p>{objeto_del_contrato}</p>
      </Section>

      {/* Alcance del servicio */}
      <Section title="ALCANCE DEL SERVICIO">
        <p className="mb-2">El servicio comprende las siguientes etapas:</p>
        <ol className="list-decimal list-inside space-y-1 ml-2">
          {etapas?.map((etapa: string, i: number) => (
            <li key={i}>{etapa}</li>
          ))}
        </ol>
      </Section>

      {/* Servicios adicionales */}
      {addon_services?.length > 0 && addon_services.map((addon: any, idx: number) => (
        <Section key={idx} title={`SERVICIO ADICIONAL: ${addon.name?.toUpperCase()}`}>
          <p className="mb-2">El servicio adicional comprende las siguientes etapas:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            {addon.etapas?.map((etapa: string, i: number) => (
              <li key={i}>{etapa}</li>
            ))}
          </ol>
        </Section>
      ))}

      {/* Honorarios */}
      <Section title="HONORARIOS Y FORMA DE PAGO">
        {has_installments ? (
          initial_payment > 0 ? (
            <p>
              Los honorarios por los servicios descritos en este contrato ascienden a un total de <strong>${total_price.toLocaleString()} USD</strong>.
              El CLIENTE realizar&aacute; un pago inicial de <strong>${initial_payment.toLocaleString()} USD</strong> al momento de la firma del contrato,
              y el saldo restante de <strong>${remaining.toLocaleString()} USD</strong> ser&aacute; pagadero en {installment_count} cuotas mensuales de <strong>${monthly.toLocaleString()} USD</strong> cada una.
            </p>
          ) : (
            <p>
              Los honorarios por los servicios descritos en este contrato ascienden a un total de <strong>${total_price.toLocaleString()} USD</strong>,
              pagaderos en {installment_count} cuotas mensuales de <strong>${monthly.toLocaleString()} USD</strong> cada una.
            </p>
          )
        ) : (
          <p>
            Los honorarios por los servicios descritos en este contrato ascienden a un total de <strong>${total_price.toLocaleString()} USD</strong>,
            pagaderos en un pago &uacute;nico al momento de la contrataci&oacute;n del servicio.
          </p>
        )}
        <p className="mt-2">M&eacute;todo de pago Zelle: Henryorellana@usalatinoprime.com</p>
      </Section>

      {/* Cronograma de pagos */}
      {payment_schedule?.length > 0 && (
        <Section title="CRONOGRAMA DE PAGOS">
          <p className="mb-3">
            Las fechas de pago de cada cuota ser&aacute;n las indicadas a continuaci&oacute;n. El CLIENTE se compromete a realizar cada pago en la fecha establecida o antes de la misma.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-[#002855]/20">
                  <th className="text-left py-2 text-[#002855] font-semibold">Cuota</th>
                  <th className="text-left py-2 text-[#002855] font-semibold">Fecha de Pago</th>
                  <th className="text-right py-2 text-[#002855] font-semibold">Monto</th>
                </tr>
              </thead>
              <tbody>
                {payment_schedule.map((item: any) => (
                  <tr key={item.number} className="border-b border-gray-100">
                    <td className="py-1.5">{item.number === 0 ? 'Cuota inicial' : `Cuota ${item.number}`}</td>
                    <td className="py-1.5">{formatDateSpanish(item.date)}</td>
                    <td className="py-1.5 text-right font-medium">${item.amount?.toLocaleString()} USD</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#002855]/20 font-bold text-[#002855]">
                  <td className="py-2" colSpan={2}>TOTAL</td>
                  <td className="py-2 text-right">
                    ${payment_schedule.reduce((sum: number, i: any) => sum + (i.amount || 0), 0).toLocaleString()} USD
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>
      )}

      {/* Gastos */}
      <Section title="GASTOS INCLUIDOS Y NO INCLUIDOS">
        <p className="mb-2">
          Los honorarios descritos incluyen todos los costos de traducci&oacute;n, certificaci&oacute;n de documentos,
          env&iacute;os postales y dem&aacute;s gastos operativos relacionados con la preparaci&oacute;n del caso.
          Dichos gastos son cubiertos en su totalidad por EL CONSULTOR como parte del servicio contratado.
        </p>
        <p>
          Los honorarios NO incluyen gastos gubernamentales (filing fees) que las agencias de gobierno
          requieran para procesar la solicitud. Dichos gastos ser&aacute;n responsabilidad del CLIENTE y se
          le informar&aacute; oportunamente sobre los montos correspondientes.
        </p>
      </Section>

      {/* Naturaleza */}
      <Section title="NATURALEZA DEL SERVICIO">
        <p>
          El CONSULTOR brinda servicios de asesor&iacute;a y asistencia en la preparaci&oacute;n de documentos y tr&aacute;mites
          migratorios. El CONSULTOR no es abogado y no ofrece representaci&oacute;n legal ante ninguna agencia gubernamental
          ni tribunal. Los resultados del proceso dependen de las autoridades competentes y no pueden ser garantizados.
        </p>
      </Section>

      {/* Obligaciones */}
      <Section title="OBLIGACIONES DEL CLIENTE">
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Proporcionar informaci&oacute;n veraz y completa para la preparaci&oacute;n de su caso.</li>
          <li>Entregar la documentaci&oacute;n solicitada en los plazos acordados.</li>
          <li>Realizar los pagos seg&uacute;n el plan de cuotas establecido.</li>
          <li>Asistir puntualmente a todas las citas programadas.</li>
          <li>Informar al CONSULTOR de cualquier cambio en su situaci&oacute;n personal o migratoria.</li>
        </ul>
      </Section>

      {/* Política de cancelación */}
      <Section title="POL&Iacute;TICA DE CANCELACI&Oacute;N Y REEMBOLSO">
        <p className="mb-2">
          Una vez firmado el presente contrato, no se realizar&aacute;n devoluciones de dinero por los servicios contratados.
          Los pagos realizados corresponden al inicio y avance del trabajo de preparaci&oacute;n del caso,
          el cual comienza inmediatamente despu&eacute;s de la firma.
        </p>
        <p className="mb-2">
          Si EL CLIENTE desea dar por terminado este contrato, deber&aacute; hacerlo &uacute;nicamente por mutuo acuerdo
          con EL CONSULTOR. Para ello, EL CLIENTE enviar&aacute; una carta escrita expresando su voluntad de
          terminar la relaci&oacute;n contractual. EL CONSULTOR evaluar&aacute; la solicitud y ambas partes acordar&aacute;n
          los t&eacute;rminos de la terminaci&oacute;n.
        </p>
        <p>
          En ning&uacute;n caso podr&aacute; EL CLIENTE dar por terminado el contrato de forma unilateral sin el
          consentimiento escrito de EL CONSULTOR.
        </p>
      </Section>

      {/* Aceptacion */}
      <Section title="ACEPTACI&Oacute;N">
        <p>
          Ambas partes declaran haber le&iacute;do y comprendido el contenido de este contrato, y lo aceptan
          en todas sus partes, firmando a continuaci&oacute;n en se&ntilde;al de conformidad.
        </p>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-[#002855] uppercase tracking-wide mb-1">{title}</h3>
      <div className="h-px bg-gray-200 mb-3" />
      <div className="ml-1">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="text-gray-500">{label}:</span>{' '}
      <span className="text-gray-800">{value}</span>
    </p>
  )
}
