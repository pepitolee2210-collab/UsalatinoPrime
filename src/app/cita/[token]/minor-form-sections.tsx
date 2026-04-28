'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, UserPlus, Trash2 } from 'lucide-react'
import { AIImproveButton } from '@/components/ai-improve-button'
import { FieldLabel, LegalFieldInput, ValidatedInput } from './form-components'
import { VoiceTextarea } from '@/components/voice/VoiceTextarea'
import { useVoiceToken } from '@/components/voice/voice-context'

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
  const token = useVoiceToken()
  if (rows >= 4 && token) {
    return (
      <VoiceTextarea
        token={token}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        micAccentClass="text-[#9a6500] hover:text-[#F2A900]"
      />
    )
  }
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
      <AIImproveButton question={question} value={value} context="minor" onChange={onChange} />
    </div>
  )
}

function YesNo({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="flex gap-2">
        {['Sí', 'No'].map(opt => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              value === opt ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>{opt}</button>
        ))}
      </div>
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
          <span className="w-7 h-7 rounded-lg bg-[#F2A900] text-[#001020] text-xs font-bold flex items-center justify-center">{number}</span>
          <span className="text-sm font-bold text-gray-900">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </div>
  )
}

// ══ INTERFACES ════════════════════════════════════════════════════

export interface MinorBasicData {
  full_name: string; dob: string; country: string; nationality: string
  birth_city: string; id_type: string; id_number: string
  civil_status: string; in_us: string; address: string
  lives_with: string; lives_with_relationship: string
  how_arrived: string; arrival_date: string; accompanied_by: string
  detained_by_immigration: string; released_by_orr: string; orr_sponsor: string
  // I-360 immigration fields
  a_number: string; ssn: string; i94_number: string
  nonimmigrant_status: string; court_order_date: string
}

export interface MinorAbuseData {
  life_in_country: string
  abuse_by_father: string; abuse_by_mother: string
  physical_abuse: string; emotional_abuse: string
  negligence: string; abandonment: string; abandonment_details: string
  parent_substance_abuse: string
}

export interface MinorBestInterestData {
  reported_to_authorities: string; report_details: string
  physical_scars: string; therapy_received: string; therapy_details: string
  fear_of_return: string; fear_details: string
  gang_threats: string; gang_details: string
  caretaker_in_country: string; current_life_us: string; attends_school: string
  safe_home: string; legal_problems: string
  wants_to_stay: string; why_stay: string
}

// ══ SECTION 1: INFORMACIÓN BÁSICA (Q1-11) ════════════════════════

export function MinorBasicSection({ data, onChange }: { data: MinorBasicData; onChange: (d: MinorBasicData) => void }) {
  function upd(f: keyof MinorBasicData, v: string) { onChange({ ...data, [f]: v }) }

  return (
    <Section title="Información Básica del Menor" number={1}>
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
        Esta información identifica al menor y establece su elegibilidad para la Visa Juvenil.
      </div>
      <div>
        <FieldLabel required>1. Nombre completo</FieldLabel>
        <TInput value={data.full_name} onChange={v => upd('full_name', v)} placeholder="Nombre y apellidos completos del menor" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel required>2. Fecha de nacimiento</FieldLabel><TInput type="date" value={data.dob} onChange={v => upd('dob', v)} /></div>
        <div><FieldLabel required>3. País de nacimiento</FieldLabel><ValidatedInput value={data.country} onChange={v => upd('country', v)} placeholder="Ej: Honduras" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><FieldLabel required>Ciudad de nacimiento</FieldLabel><ValidatedInput value={data.birth_city} onChange={v => upd('birth_city', v)} placeholder="Ej: Guayaquil" /></div>
        <div><FieldLabel help="Tipo de documento del menor (Pasaporte, Partida de Nacimiento, DNI). Si aún no tiene ninguno, marque la casilla en el siguiente campo.">Tipo de documento</FieldLabel><LegalFieldInput value={data.id_type} onChange={v => upd('id_type', v)} placeholder="Ej: Pasaporte" /></div>
        <div><FieldLabel help="Número del documento del menor. Aparece en los formularios migratorios (I-360, I-485). Si el menor no tiene documento, marque la casilla.">No. de documento</FieldLabel><LegalFieldInput value={data.id_number} onChange={v => upd('id_number', v)} placeholder="Número de documento" /></div>
      </div>
      <div>
        <FieldLabel>4. Estado civil actual</FieldLabel>
        <div className="flex gap-2">
          {['Soltero/a', 'Casado/a'].map(opt => (
            <button key={opt} type="button" onClick={() => upd('civil_status', opt)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                data.civil_status === opt ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]' : 'border-gray-200 text-gray-600'
              }`}>{opt}</button>
          ))}
        </div>
      </div>
      <div><FieldLabel required>5. Dirección actual donde reside</FieldLabel><ValidatedInput value={data.address} onChange={v => upd('address', v)} placeholder="Dirección completa en EE.UU." /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>6. ¿Con quién vive actualmente?</FieldLabel><TInput value={data.lives_with} onChange={v => upd('lives_with', v)} placeholder="Nombre de la persona" /></div>
        <div><FieldLabel>Relación</FieldLabel><TInput value={data.lives_with_relationship} onChange={v => upd('lives_with_relationship', v)} placeholder="Ej: Madre, tía, tutor" /></div>
      </div>
      <div><FieldLabel>7. ¿Cómo llegó a los Estados Unidos?</FieldLabel><TArea value={data.how_arrived} onChange={v => upd('how_arrived', v)} placeholder="Fecha aproximada y circunstancias del viaje" rows={3} /></div>
      <div><FieldLabel>8. ¿Vino solo/a o acompañado/a? ¿Por quién?</FieldLabel><TInput value={data.accompanied_by} onChange={v => upd('accompanied_by', v)} placeholder="Solo/a, con su madre, con un coyote..." /></div>

      {/* Immigration details for I-360 */}
      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-800 mt-2">
        Datos migratorios — Si tiene esta información disponible, por favor complétela. Es necesaria para el formulario I-360.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>A-Number (si tiene)</FieldLabel><TInput value={data.a_number} onChange={v => upd('a_number', v)} placeholder="Ej: A-123456789" /></div>
        <div><FieldLabel>Social Security (si tiene)</FieldLabel><TInput value={data.ssn} onChange={v => upd('ssn', v)} placeholder="Ej: 123-45-6789" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>Número I-94</FieldLabel><TInput value={data.i94_number} onChange={v => upd('i94_number', v)} placeholder="Número de registro de llegada" /></div>
        <div><FieldLabel>Estatus migratorio actual</FieldLabel><TInput value={data.nonimmigrant_status} onChange={v => upd('nonimmigrant_status', v)} placeholder="Ej: Solicitante de asilo, Parolee" /></div>
      </div>
      <div>
        <FieldLabel>Fecha de la orden de la corte juvenil (si ya tiene)</FieldLabel>
        <TInput type="date" value={data.court_order_date} onChange={v => upd('court_order_date', v)} />
      </div>
    </Section>
  )
}

// ══ SECTION 2: HECHOS DE MALTRATO (Q12-19) ═══════════════════════

export function MinorAbuseSection({ data, onChange }: { data: MinorAbuseData; onChange: (d: MinorAbuseData) => void }) {
  function upd(f: keyof MinorAbuseData, v: string) { onChange({ ...data, [f]: v }) }

  return (
    <Section title="Hechos de Maltrato" number={2}>
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        Esta sección es fundamental para el caso. Es importante describir con el mayor detalle posible cada situación.
        La información es completamente confidencial y se utiliza en un ambiente informado en trauma.
      </div>
      <div>
        <FieldLabel>9. Describa su vida en su país de origen: ¿con quién vivía?</FieldLabel>
        <TAreaAI question="Describa su vida en su país de origen" value={data.life_in_country} onChange={v => upd('life_in_country', v)}
          placeholder="Cuente cómo era su vida, con quién vivía, en qué condiciones..." rows={4} />
      </div>
      <div>
        <FieldLabel required>10. Describa los hechos de abuso, abandono o negligencia por parte de su PADRE</FieldLabel>
        <TAreaAI question="Describa los hechos de abuso, abandono o negligencia por parte de su padre" value={data.abuse_by_father} onChange={v => upd('abuse_by_father', v)}
          placeholder="¿Qué hizo su padre? ¿Lo/la golpeó, abandonó, ignoró? ¿Nunca se hizo cargo? Incluya fechas y detalles..." rows={5} />
      </div>
      <div>
        <FieldLabel required>11. Describa los hechos de abuso, abandono o negligencia por parte de su MADRE</FieldLabel>
        <TAreaAI question="Describa los hechos de abuso, abandono o negligencia por parte de su madre" value={data.abuse_by_mother} onChange={v => upd('abuse_by_mother', v)}
          placeholder="Si aplica: ¿Qué hizo su madre? Si no aplica, escriba 'No aplica — mi madre es quien me cuida'." rows={5} />
      </div>
      <div>
        <FieldLabel>12. ¿Recibió golpes, castigos físicos excesivos, o violencia física?</FieldLabel>
        <TAreaAI question="¿Recibió golpes, castigos físicos excesivos, o violencia física?" value={data.physical_abuse} onChange={v => upd('physical_abuse', v)}
          placeholder="Describa los hechos específicos de abuso físico..." rows={3} />
      </div>
      <div>
        <FieldLabel>13. ¿Fue víctima de abuso verbal, emocional o psicológico?</FieldLabel>
        <TAreaAI question="¿Fue víctima de abuso verbal, emocional o psicológico?" value={data.emotional_abuse} onChange={v => upd('emotional_abuse', v)}
          placeholder="Insultos, amenazas, humillaciones, aislamiento..." rows={3} />
      </div>
      <div>
        <FieldLabel>14. ¿Sus padres dejaron de proveerle alimentación, vivienda, ropa o atención médica?</FieldLabel>
        <TAreaAI question="¿Sus padres dejaron de proveerle alimentación, vivienda o atención médica?" value={data.negligence} onChange={v => upd('negligence', v)}
          placeholder="Describa las carencias que sufrió..." rows={3} />
      </div>
      <div>
        <FieldLabel>15. ¿Alguno de sus padres lo/la abandonó? ¿Cuándo y por cuánto tiempo?</FieldLabel>
        <TAreaAI question="¿Alguno de sus padres lo/la abandonó? ¿Cuándo y por cuánto tiempo?" value={data.abandonment} onChange={v => upd('abandonment', v)}
          placeholder="Cuente cuándo lo/la dejaron y qué pasó después..." rows={3} />
      </div>
      <div>
        <FieldLabel>16. ¿Su padre o madre tiene problemas de alcoholismo, drogas o actividades ilegales?</FieldLabel>
        <TArea value={data.parent_substance_abuse} onChange={v => upd('parent_substance_abuse', v)}
          placeholder="Si aplica, describa la situación..." rows={3} />
      </div>
    </Section>
  )
}

// ══ SECTION 3: MEJOR INTERÉS Y SITUACIÓN (Q21-30) ════════════════

export function MinorBestInterestSection({ data, onChange }: { data: MinorBestInterestData; onChange: (d: MinorBestInterestData) => void }) {
  function upd(f: keyof MinorBestInterestData, v: string) { onChange({ ...data, [f]: v }) }

  return (
    <Section title="Mejor Interés y Situación Actual" number={3}>
      <div>
        <YesNo label="17. ¿Reportó el abuso a alguna autoridad, maestro, trabajador social o médico?" value={data.reported_to_authorities} onChange={v => upd('reported_to_authorities', v)} />
        {data.reported_to_authorities === 'Sí' && (
          <TArea value={data.report_details} onChange={v => upd('report_details', v)} placeholder="¿A quién reportó y qué pasó?" rows={3} />
        )}
      </div>
      <div><FieldLabel>18. ¿Tiene cicatrices, marcas o secuelas físicas del maltrato?</FieldLabel><TInput value={data.physical_scars} onChange={v => upd('physical_scars', v)} placeholder="Describa si tiene marcas visibles" /></div>
      <div>
        <YesNo label="19. ¿Ha recibido terapia psicológica o tratamiento médico por el maltrato?" value={data.therapy_received} onChange={v => upd('therapy_received', v)} />
        {data.therapy_received === 'Sí' && (
          <TArea value={data.therapy_details} onChange={v => upd('therapy_details', v)} placeholder="Describa el tratamiento..." rows={3} />
        )}
      </div>
      <div><YesNo label="20. ¿Hay alguien en su país que pueda cuidarlo/a de manera segura?" value={data.caretaker_in_country} onChange={v => upd('caretaker_in_country', v)} /></div>
      <div>
        <FieldLabel>21. ¿Cómo es su vida actual en EE.UU.?</FieldLabel>
        <TArea value={data.current_life_us} onChange={v => upd('current_life_us', v)}
          placeholder="¿Cómo le va? ¿Se siente seguro/a? ¿Tiene amigos? ¿Cómo es su día a día?" rows={3} />
      </div>
      <div><YesNo label="¿Asiste a la escuela?" value={data.attends_school} onChange={v => upd('attends_school', v)} /></div>
      <div><YesNo label="22. ¿Su guardián/custodio actual le provee un hogar seguro y estable?" value={data.safe_home} onChange={v => upd('safe_home', v)} /></div>
      <div><YesNo label="23. ¿Ha tenido algún problema legal o ha sido arrestado/a en EE.UU.?" value={data.legal_problems} onChange={v => upd('legal_problems', v)} /></div>
      <div>
        <FieldLabel required>24. ¿Desea permanecer en los Estados Unidos? ¿Por qué?</FieldLabel>
        <TAreaAI question="¿Desea permanecer en los Estados Unidos? ¿Por qué?" value={data.wants_to_stay} onChange={v => upd('wants_to_stay', v)}
          placeholder="Exprese su deseo de quedarse y las razones: seguridad, educación, familia, oportunidades..." rows={4} />
      </div>
    </Section>
  )
}
