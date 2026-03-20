'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, UserPlus, Trash2 } from 'lucide-react'
import { AIImproveButton } from '@/components/ai-improve-button'

// Reusable field components
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium text-gray-700 mb-1.5 block">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function TInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/40" />
  )
}

function TArea({ value, onChange, placeholder, rows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/40 resize-none" />
  )
}

function TAreaAI({ value, onChange, placeholder, rows = 4, question }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; question: string
}) {
  return (
    <div>
      <TArea value={value} onChange={onChange} placeholder={placeholder} rows={rows} />
      <AIImproveButton question={question} value={value} context="tutor" onChange={onChange} />
    </div>
  )
}

function YesNo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {['Sí', 'No'].map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
            value === opt ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>{opt}</button>
      ))}
    </div>
  )
}

function Section({ title, number, children }: { title: string; number: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-[#002855] text-white text-xs font-bold flex items-center justify-center">{number}</span>
          <span className="text-sm font-bold text-gray-900">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </div>
  )
}

// ══ TUTOR FORM SECTIONS (30 questions) ═══════════════════════════

interface TutorWitness { name: string; relationship: string; phone: string; address: string; can_testify: string }

interface TutorFormData {
  [key: string]: string | TutorWitness[]
}

export function TutorFormSections({ data, onChange }: { data: TutorFormData; onChange: (d: TutorFormData) => void }) {
  function upd(field: string, value: string) { onChange({ ...data, [field]: value }) }
  const witnesses = (data.witnesses || []) as TutorWitness[]

  return (
    <div className="space-y-4">
      {/* Sección 1: Información Básica */}
      <Section title="Información Básica del Declarante" number={1}>
        <div>
          <FieldLabel required>1. Nombre completo del padre/madre/tutor declarante</FieldLabel>
          <TInput value={data.full_name as string || ''} onChange={v => upd('full_name', v)} placeholder="Nombre y apellidos completos" />
        </div>
        <div>
          <FieldLabel required>2. Relación exacta con el menor</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {['Madre biológica', 'Padre biológico', 'Tutor legal', 'Abuelo/a', 'Tío/a', 'Otro familiar'].map(opt => (
              <button key={opt} type="button" onClick={() => upd('relationship_to_minor', opt)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  data.relationship_to_minor === opt ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>{opt}</button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel required>3. Dirección actual completa de residencia en EE.UU.</FieldLabel>
          <TInput value={data.full_address as string || ''} onChange={v => upd('full_address', v)} placeholder="Calle, ciudad, estado, código postal" />
        </div>
        <div>
          <FieldLabel>4. ¿Cuánto tiempo ha residido en este estado?</FieldLabel>
          <TInput value={data.time_in_state as string || ''} onChange={v => upd('time_in_state', v)} placeholder="Ej: 3 años / Desde 2021" />
        </div>
        <div>
          <FieldLabel>5. Estado migratorio actual del declarante</FieldLabel>
          <TInput value={data.immigration_status as string || ''} onChange={v => upd('immigration_status', v)} placeholder="Ej: TPS, asilo pendiente, sin estatus, visa..." />
        </div>
      </Section>

      {/* Sección 2: Sobre el Menor */}
      <Section title="Información del Menor" number={2}>
        <div>
          <FieldLabel required>6. Nombre completo del menor</FieldLabel>
          <TInput value={data.minor_full_name as string || ''} onChange={v => upd('minor_full_name', v)} placeholder="Nombre completo del menor" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel required>7. Fecha de nacimiento del menor</FieldLabel>
            <TInput type="date" value={data.minor_dob as string || ''} onChange={v => upd('minor_dob', v)} />
          </div>
          <div>
            <FieldLabel>8. País de nacimiento del menor</FieldLabel>
            <TInput value={data.minor_country as string || ''} onChange={v => upd('minor_country', v)} placeholder="Ej: Honduras, Guatemala..." />
          </div>
        </div>
        <div>
          <FieldLabel>9. Estado civil actual del menor</FieldLabel>
          <div className="flex gap-2">
            {['Soltero/a', 'Casado/a'].map(opt => (
              <button key={opt} type="button" onClick={() => upd('minor_civil_status', opt)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  data.minor_civil_status === opt ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>{opt}</button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>10. ¿Dónde se encuentra actualmente el menor? (dirección completa)</FieldLabel>
          <TInput value={data.minor_location as string || ''} onChange={v => upd('minor_location', v)} placeholder="Dirección completa en EE.UU." />
        </div>
        <div>
          <FieldLabel>11. ¿Con quién vive actualmente el menor?</FieldLabel>
          <TInput value={data.minor_lives_with as string || ''} onChange={v => upd('minor_lives_with', v)} placeholder="Nombre y relación" />
        </div>
        <div>
          <FieldLabel>12. ¿Desde cuándo vive el menor con esta persona?</FieldLabel>
          <TInput value={data.minor_lives_with_since as string || ''} onChange={v => upd('minor_lives_with_since', v)} placeholder="Ej: Desde 2022 / Desde su nacimiento" />
        </div>
      </Section>

      {/* Sección 3: Hechos de Maltrato */}
      <Section title="Hechos de Maltrato" number={3}>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Esta sección es la más importante para el caso. Describa con el mayor detalle posible: nombres, fechas, lugares y circunstancias.
        </div>
        <div>
          <FieldLabel required>13. ¿Por qué el menor no puede reunificarse con uno o ambos padres?</FieldLabel>
          <TAreaAI question="¿Por qué el menor no puede reunificarse con uno o ambos padres?" value={data.why_cannot_reunify as string || ''} onChange={v => upd('why_cannot_reunify', v)}
            placeholder="Explique las razones por las que el menor no puede volver a vivir con su padre, madre o ambos..." rows={5} />
        </div>
        <div>
          <FieldLabel required>14. Describa en detalle los hechos de abuso, abandono o negligencia que sufrió el menor</FieldLabel>
          <TAreaAI question="Describa en detalle los hechos de abuso, abandono o negligencia" value={data.abuse_description as string || ''} onChange={v => upd('abuse_description', v)}
            placeholder="Cuente todo: golpes, abandono, falta de alimento, maltrato verbal, violencia, negligencia médica... Sea lo más detallado posible." rows={6} />
        </div>
        <div>
          <FieldLabel>15. ¿Quién perpetró el abuso/abandono/negligencia?</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {['Padre', 'Madre', 'Ambos padres', 'Padrastro/Madrastra', 'Otro familiar'].map(opt => (
              <button key={opt} type="button" onClick={() => upd('who_perpetrated', opt)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  data.who_perpetrated === opt ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>{opt}</button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>16. ¿Cuándo ocurrieron estos hechos? (fechas aproximadas)</FieldLabel>
          <TInput value={data.when_occurred as string || ''} onChange={v => upd('when_occurred', v)} placeholder="Ej: Desde 2015 hasta 2022 / Toda la infancia" />
        </div>
        <div>
          <FieldLabel>17. ¿Dónde ocurrieron estos hechos?</FieldLabel>
          <TInput value={data.where_occurred as string || ''} onChange={v => upd('where_occurred', v)} placeholder="País de origen, EE.UU., o ambos" />
        </div>
        <div>
          <FieldLabel>18. ¿Existen reportes policiales, médicos, escolares o de trabajadores sociales?</FieldLabel>
          <YesNo value={data.evidence_exists as string || ''} onChange={v => upd('evidence_exists', v)} />
          {data.evidence_exists === 'Sí' && (
            <TArea value={data.evidence_description as string || ''} onChange={v => upd('evidence_description', v)}
              placeholder="Describa qué documentos existen: denuncias, informes médicos, reportes escolares..." rows={3} />
          )}
        </div>
        <div>
          <FieldLabel>19. ¿El menor ha recibido tratamiento médico o psicológico por el maltrato?</FieldLabel>
          <YesNo value={data.minor_treatment as string || ''} onChange={v => upd('minor_treatment', v)} />
          {data.minor_treatment === 'Sí' && (
            <TArea value={data.treatment_description as string || ''} onChange={v => upd('treatment_description', v)}
              placeholder="Describa el tratamiento recibido..." rows={3} />
          )}
        </div>
      </Section>

      {/* Sección 4: Mejor Interés */}
      <Section title="Mejor Interés del Menor" number={4}>
        <div>
          <FieldLabel required>20. ¿Existe riesgo para el menor de ser devuelto a su país de origen? Describa.</FieldLabel>
          <TAreaAI question="¿Existe riesgo para el menor de ser devuelto a su país de origen?" value={data.risk_if_returned as string || ''} onChange={v => upd('risk_if_returned', v)}
            placeholder="Pobreza, violencia, falta de acceso a educación/salud, amenazas, pandillas, falta de familia..." rows={5} />
        </div>
        <div>
          <FieldLabel>21. ¿Hay un cuidador apropiado para el menor en su país de origen?</FieldLabel>
          <YesNo value={data.caretaker_in_country as string || ''} onChange={v => upd('caretaker_in_country', v)} />
        </div>
        <div>
          <FieldLabel>22. ¿El menor tiene acceso a educación, salud y seguridad en su país de origen?</FieldLabel>
          <TArea value={data.access_to_services as string || ''} onChange={v => upd('access_to_services', v)}
            placeholder="Describa las condiciones en el país de origen..." rows={3} />
        </div>
        <div>
          <FieldLabel>23. ¿El menor ha sido amenazado por pandillas, crimen organizado o violencia en su país?</FieldLabel>
          <TAreaAI question="¿El menor ha sido amenazado por pandillas o crimen organizado?" value={data.gang_threats as string || ''} onChange={v => upd('gang_threats', v)}
            placeholder="Si aplica, describa las amenazas o situaciones de peligro..." rows={3} />
        </div>
      </Section>

      {/* Sección 5: Proceso Legal */}
      <Section title="Proceso Legal" number={5}>
        <div>
          <FieldLabel>24. ¿El padre no-maltratante está dispuesto a firmar consentimiento de custodia/guardianía?</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {['Sí', 'No', 'No aplica', 'No se sabe'].map(opt => (
              <button key={opt} type="button" onClick={() => upd('parent_consent', opt)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  data.parent_consent === opt ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>{opt}</button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>25. ¿El menor está actualmente en procedimientos de remoción/deportación?</FieldLabel>
          <YesNo value={data.minor_in_removal as string || ''} onChange={v => upd('minor_in_removal', v)} />
        </div>
        <div>
          <FieldLabel>26. ¿El menor fue aprehendido en la frontera y liberado a un patrocinador por ORR?</FieldLabel>
          <YesNo value={data.minor_released_orr as string || ''} onChange={v => upd('minor_released_orr', v)} />
          {data.minor_released_orr === 'Sí' && (
            <TInput value={data.orr_details as string || ''} onChange={v => upd('orr_details', v)} placeholder="¿A quién fue liberado?" />
          )}
        </div>
        <div>
          <FieldLabel>27. ¿El guardián/custodio propuesto tiene antecedentes penales?</FieldLabel>
          <YesNo value={data.guardian_criminal_record as string || ''} onChange={v => upd('guardian_criminal_record', v)} />
        </div>
        <div>
          <FieldLabel>28. ¿El guardián propuesto puede proveer vivienda, alimentación, educación y atención médica?</FieldLabel>
          <TAreaAI question="¿El guardián puede proveer vivienda, alimentación, educación y atención médica?" value={data.guardian_can_provide as string || ''} onChange={v => upd('guardian_can_provide', v)}
            placeholder="Describa cómo el guardián puede cuidar al menor..." rows={3} />
        </div>
        <div>
          <FieldLabel>29. ¿Hay otros miembros del hogar mayores de 18 años?</FieldLabel>
          <TArea value={data.household_members as string || ''} onChange={v => upd('household_members', v)}
            placeholder="Nombres y relación de cada persona mayor de 18 años en el hogar" rows={3} />
        </div>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <FieldLabel>30. ¿Entiende que SIJS NO otorga beneficios migratorios a los padres del menor?</FieldLabel>
          <p className="text-xs text-blue-700 mb-2">
            Importante: La Visa Juvenil (SIJS) es solo para el menor. Los padres NO pueden ser patrocinados a través de este proceso.
          </p>
          <YesNo value={data.understands_sijs as string || ''} onChange={v => upd('understands_sijs', v)} />
        </div>
      </Section>

      {/* Testigos */}
      <Section title="Testigos" number={6}>
        <p className="text-sm text-gray-500 mb-2">
          Personas que conocen su situación y pueden confirmar los hechos declarados.
        </p>
        {witnesses.map((w, i) => (
          <div key={i} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Testigo {i + 1}</span>
              {witnesses.length > 1 && (
                <button type="button" onClick={() => onChange({ ...data, witnesses: witnesses.filter((_, j) => j !== i) })}
                  className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>Nombre</FieldLabel><TInput value={w.name} onChange={v => { const ws = [...witnesses]; ws[i] = { ...ws[i], name: v }; onChange({ ...data, witnesses: ws }) }} placeholder="Nombre completo" /></div>
              <div><FieldLabel>Relación</FieldLabel><TInput value={w.relationship} onChange={v => { const ws = [...witnesses]; ws[i] = { ...ws[i], relationship: v }; onChange({ ...data, witnesses: ws }) }} placeholder="Ej: Hermana, vecina" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>Teléfono</FieldLabel><TInput value={w.phone} onChange={v => { const ws = [...witnesses]; ws[i] = { ...ws[i], phone: v }; onChange({ ...data, witnesses: ws }) }} placeholder="Número" /></div>
              <div><FieldLabel>Dirección</FieldLabel><TInput value={w.address} onChange={v => { const ws = [...witnesses]; ws[i] = { ...ws[i], address: v }; onChange({ ...data, witnesses: ws }) }} placeholder="Ciudad, Estado" /></div>
            </div>
            <div>
              <FieldLabel>¿Qué puede declarar?</FieldLabel>
              <TArea value={w.can_testify} onChange={v => { const ws = [...witnesses]; ws[i] = { ...ws[i], can_testify: v }; onChange({ ...data, witnesses: ws }) }}
                placeholder="¿Qué hechos conoce? ¿Qué presenció?" rows={3} />
            </div>
          </div>
        ))}
        {witnesses.length < 5 && (
          <button type="button"
            onClick={() => onChange({ ...data, witnesses: [...witnesses, { name: '', relationship: '', phone: '', address: '', can_testify: '' }] })}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-[#F2A900] text-sm font-bold text-[#9a6500] bg-[#F2A900]/10">
            <UserPlus className="w-4 h-4" /> Agregar otro testigo
          </button>
        )}
      </Section>
    </div>
  )
}
