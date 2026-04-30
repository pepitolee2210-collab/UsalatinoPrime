'use client'

import { FileText } from 'lucide-react'

interface FormSubmission {
  form_type: string
  form_data: Record<string, unknown>
  status: string
  updated_at: string
  minor_index: number
}

interface I360SectionProps {
  submission?: FormSubmission
}

export function I360Section({ submission }: I360SectionProps) {
  if (!submission) {
    return (
      <div className="text-center py-12">
        <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">El cliente aún no ha llenado el formulario I-360.</p>
      </div>
    )
  }

  const d = submission.form_data as Record<string, string>
  const status = submission.status

  const sections = [
    { title: 'Part 1 — Peticionario', color: 'indigo', fields: [
      { label: 'Nombre', value: `${d.petitioner_first_name || ''} ${d.petitioner_middle_name || ''} ${d.petitioner_last_name || ''}`.trim() },
      { label: 'SSN', value: d.petitioner_ssn },
      { label: 'A-Number', value: d.petitioner_a_number },
      { label: 'Dirección', value: `${d.petitioner_address || ''}, ${d.petitioner_city || ''} ${d.petitioner_state || ''} ${d.petitioner_zip || ''}`.trim() },
      { label: 'Dir. segura', value: d.safe_mailing_address ? `${d.safe_mailing_name} — ${d.safe_mailing_address}` : '' },
    ]},
    { title: 'Part 3 — Beneficiario (Menor)', color: 'blue', fields: [
      { label: 'Nombre', value: `${d.beneficiary_first_name || ''} ${d.beneficiary_middle_name || ''} ${d.beneficiary_last_name || ''}`.trim() },
      { label: 'Otros nombres', value: d.other_names },
      { label: 'DOB', value: d.beneficiary_dob },
      { label: 'País/Ciudad', value: `${d.beneficiary_city_birth || ''}, ${d.beneficiary_country_birth || ''}` },
      { label: 'Sexo', value: d.beneficiary_sex },
      { label: 'Estado civil', value: d.beneficiary_marital_status },
      { label: 'SSN', value: d.beneficiary_ssn },
      { label: 'A-Number', value: d.beneficiary_a_number },
      { label: 'Pasaporte', value: `${d.beneficiary_passport_number || ''} (${d.beneficiary_passport_country || ''})` },
      { label: 'I-94', value: d.beneficiary_i94_number },
      { label: 'Última llegada', value: d.beneficiary_last_arrival_date },
      { label: 'Status', value: d.beneficiary_nonimmigrant_status },
    ]},
    { title: 'Part 4 — Procesamiento', color: 'amber', fields: [
      { label: 'Padre/Madre extranjero', value: `${d.foreign_parent_first_name || ''} ${d.foreign_parent_last_name || ''}`.trim() },
      { label: 'En removal proceedings', value: d.in_removal_proceedings },
      { label: 'Otras peticiones', value: d.other_petitions },
      { label: 'Ajuste de estatus', value: d.adjustment_attached },
    ]},
    { title: 'Part 5 — Cónyuge/Hijos', color: 'emerald', fields: [
      { label: 'Hijos con peticiones separadas', value: d.children_filed_separate },
      { label: 'Persona 1', value: d.spouse_child_1_first_name ? `${d.spouse_child_1_first_name} ${d.spouse_child_1_last_name}` : '' },
    ]},
    { title: 'Part 8 — SIJS', color: 'purple', fields: [
      { label: '2A. Dependiente de corte', value: d.declared_dependent_court },
      { label: '2B. Corte/Agencia', value: d.state_agency_name },
      { label: '2C. Bajo jurisdicción', value: d.currently_under_jurisdiction },
      { label: '3A. En placement', value: d.in_court_ordered_placement },
      { label: '4. Reunificación no viable', value: d.reunification_not_viable_reason },
      { label: '5. Mejor interés no regresar', value: d.best_interest_not_return },
      { label: '6A. Custodia HHS', value: d.previously_hhs_custody },
    ]},
    { title: 'Part 11/15 — Contacto', color: 'gray', fields: [
      { label: 'Teléfono', value: d.petitioner_phone },
      { label: 'Celular', value: d.petitioner_mobile },
      { label: 'Email', value: d.petitioner_email },
      { label: 'Idioma', value: d.language_understood },
      { label: 'Intérprete', value: d.interpreter_needed },
      { label: 'Info adicional', value: d.additional_info },
    ]},
  ]

  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-900' },
    blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-900' },
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-900' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900' },
    purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-900' },
    gray:    { bg: 'bg-gray-50',    border: 'border-gray-200',    text: 'text-gray-900' },
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Formulario I-360 — SIJS</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
          status === 'submitted' ? 'bg-purple-100 text-purple-700' :
          status === 'approved' ? 'bg-green-100 text-green-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {status === 'submitted' ? 'Enviado por el cliente' : status === 'approved' ? 'Aprobado' : status === 'draft' ? 'Borrador' : status}
        </span>
      </div>

      {sections.map(section => {
        const c = colorMap[section.color] || colorMap.gray
        const filledFields = section.fields.filter(f => f.value && f.value.trim() && f.value.trim() !== ',' && f.value.trim() !== ', ,')
        if (filledFields.length === 0) return null
        return (
          <div key={section.title} className={`rounded-xl border ${c.border} overflow-hidden`}>
            <div className={`px-4 py-2.5 ${c.bg}`}>
              <span className={`text-xs font-bold ${c.text} uppercase`}>{section.title}</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-2">
              {filledFields.map(f => (
                <div key={f.label}>
                  <span className="text-[10px] text-gray-400 uppercase">{f.label}</span>
                  <p className="text-sm text-gray-900">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
