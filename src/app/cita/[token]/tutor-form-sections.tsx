'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, UserPlus, Trash2, User } from 'lucide-react'
import { AIImproveButton } from '@/components/ai-improve-button'
import { FieldLabel, LegalFieldInput, ValidatedInput } from './form-components'

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
  [key: string]: string | TutorWitness[] | Array<Record<string, string>>
}

function MinorBlock({ index, data, onChange }: {
  index: number
  data: Record<string, string>
  onChange: (field: string, value: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <User className="w-4 h-4 text-[#F2A900]" />
        <span className="text-sm font-bold text-gray-700">Menor {index + 1}</span>
      </div>
      <div>
        <FieldLabel required>Nombre completo del menor</FieldLabel>
        <TInput value={data.name || ''} onChange={v => onChange('name', v)} placeholder="Nombre y apellidos completos" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel required>Fecha de nacimiento</FieldLabel>
          <TInput type="date" value={data.dob || ''} onChange={v => onChange('dob', v)} />
        </div>
        <div>
          <FieldLabel required>País de nacimiento</FieldLabel>
          <ValidatedInput value={data.country || ''} onChange={v => onChange('country', v)} placeholder="Ej: Venezuela, Perú..." />
        </div>
      </div>
      <div>
        <FieldLabel required>Ciudad de nacimiento</FieldLabel>
        <ValidatedInput value={data.city || ''} onChange={v => onChange('city', v)} placeholder="Ej: Lima, Guayaquil, Tegucigalpa..." />
      </div>
      <div>
        <FieldLabel>Estado civil</FieldLabel>
        <div className="flex gap-2">
          {['Soltero/a', 'Casado/a'].map(opt => (
            <button key={opt} type="button" onClick={() => onChange('civil_status', opt)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                data.civil_status === opt ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>{opt}</button>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel required>Dirección actual del menor</FieldLabel>
        <ValidatedInput value={data.location || ''} onChange={v => onChange('location', v)} placeholder="Dirección completa en EE.UU." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>¿Con quién vive?</FieldLabel>
          <TInput value={data.lives_with || ''} onChange={v => onChange('lives_with', v)} placeholder="Nombre y relación" />
        </div>
        <div>
          <FieldLabel>¿Desde cuándo?</FieldLabel>
          <TInput value={data.lives_with_since || ''} onChange={v => onChange('lives_with_since', v)} placeholder="Ej: Desde 2022" />
        </div>
      </div>
    </div>
  )
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
        <div className="grid grid-cols-3 gap-3">
          <div>
            <FieldLabel required>4. Fecha de nacimiento</FieldLabel>
            <TInput type="date" value={data.date_of_birth as string || ''} onChange={v => upd('date_of_birth', v)} />
          </div>
          <div>
            <FieldLabel required help="Aparece en la petición de tutela y declaración. Debe coincidir con su pasaporte.">5. País de nacimiento</FieldLabel>
            <ValidatedInput value={data.country_of_birth as string || ''} onChange={v => upd('country_of_birth', v)} placeholder="Ej: Ecuador" />
          </div>
          <div>
            <FieldLabel required>Ciudad de nacimiento</FieldLabel>
            <ValidatedInput value={data.city_of_birth as string || ''} onChange={v => upd('city_of_birth', v)} placeholder="Ej: Guayaquil" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel required help="Su pasaporte, cédula o DNI. Este número aparece en los documentos legales que firma Henry ante la corte.">No. de documento de identidad (Pasaporte, Cédula o DNI)</FieldLabel>
            <LegalFieldInput value={data.id_number as string || ''} onChange={v => upd('id_number', v)} placeholder="Número de documento" />
          </div>
          <div>
            <FieldLabel required>Nacionalidad</FieldLabel>
            <ValidatedInput value={data.nationality as string || ''} onChange={v => upd('nationality', v)} placeholder="Ej: Ecuatoriana" />
          </div>
        </div>
        <div>
          <FieldLabel>6. ¿Cuánto tiempo ha residido en este estado?</FieldLabel>
          <TInput value={data.time_in_state as string || ''} onChange={v => upd('time_in_state', v)} placeholder="Ej: 3 años / Desde 2021" />
        </div>
      </Section>

      {/* Sección 2: Sobre los Menores */}
      <Section title="Información de los Menores" number={2}>
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 mb-2">
          Complete la información de cada menor. Si tiene más de un hijo/a en este caso, use el botón "Agregar otro menor".
        </div>

        {/* Primer menor (siempre visible) */}
        <MinorBlock
          index={0}
          data={{
            name: data.minor_full_name as string || '',
            dob: data.minor_dob as string || '',
            country: data.minor_country as string || '',
            city: data.minor_city as string || '',
            civil_status: data.minor_civil_status as string || '',
            location: data.minor_location as string || '',
            lives_with: data.minor_lives_with as string || '',
            lives_with_since: data.minor_lives_with_since as string || '',
          }}
          onChange={(field, value) => {
            const fieldMap: Record<string, string> = {
              name: 'minor_full_name', dob: 'minor_dob', country: 'minor_country',
              city: 'minor_city', civil_status: 'minor_civil_status',
              location: 'minor_location', lives_with: 'minor_lives_with',
              lives_with_since: 'minor_lives_with_since',
            }
            upd(fieldMap[field], value)
          }}
        />

        {/* Additional minors */}
        {((data.additional_minors || []) as Array<Record<string, string>>).map((minor, i) => (
          <div key={i} className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500">Menor {i + 2}</span>
              <button type="button" onClick={() => {
                const minors = [...((data.additional_minors || []) as Array<Record<string, string>>)]
                minors.splice(i, 1)
                upd('additional_minors', minors as any)
              }} className="text-xs text-red-500 hover:text-red-700">Eliminar</button>
            </div>
            <MinorBlock
              index={i + 1}
              data={minor}
              onChange={(field, value) => {
                const minors = [...((data.additional_minors || []) as Array<Record<string, string>>)]
                minors[i] = { ...minors[i], [field]: value }
                upd('additional_minors', minors as any)
              }}
            />
          </div>
        ))}

        <button type="button" onClick={() => {
          const minors = [...((data.additional_minors || []) as Array<Record<string, string>>)]
          minors.push({ name: '', dob: '', country: '', city: '', civil_status: 'Soltero/a', location: '', lives_with: '', lives_with_since: '' })
          upd('additional_minors', minors as any)
        }}
          className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-[#F2A900] hover:text-[#9a6500] transition-colors flex items-center justify-center gap-2">
          <UserPlus className="w-4 h-4" /> Agregar otro menor
        </button>
      </Section>

      {/* Sección 2.5: Datos del Padre/Madre Ausente */}
      <Section title="Datos del Padre/Madre Ausente" number={3}>
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
          Estos datos son necesarios para generar los documentos legales. Si no conoce algún dato del padre/madre ausente (ej. perdió contacto hace años), marque <strong>&ldquo;No tengo este dato&rdquo;</strong> en ese campo — es mejor que dejarlo en blanco.
        </div>
        <div>
          <FieldLabel required help="Aparece en la petición de tutela ante la corte. Si realmente no conoce el nombre completo, marque la casilla.">Nombre completo del padre/madre ausente</FieldLabel>
          <LegalFieldInput value={data.absent_parent_name as string || ''} onChange={v => upd('absent_parent_name', v)} placeholder="Nombre y apellidos completos" />
        </div>
        <div>
          <FieldLabel required>Nacionalidad del padre/madre ausente</FieldLabel>
          <LegalFieldInput value={data.absent_parent_nationality as string || ''} onChange={v => upd('absent_parent_nationality', v)} placeholder="Ej: Colombiana, Peruana, Mexicana..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel help="Pasaporte del padre/madre ausente. Si no lo tiene pero sí tiene su cédula, llene el otro campo y marque aquí &ldquo;No tengo este dato&rdquo;.">Número de pasaporte del padre/madre ausente</FieldLabel>
            <LegalFieldInput value={data.absent_parent_passport as string || ''} onChange={v => upd('absent_parent_passport', v)} placeholder="Número de pasaporte" />
          </div>
          <div>
            <FieldLabel help="Cédula, DNI u otra identificación nacional. Con uno de los dos (pasaporte o cédula) es suficiente.">Número de ID/Cédula del padre/madre ausente</FieldLabel>
            <LegalFieldInput value={data.absent_parent_id as string || ''} onChange={v => upd('absent_parent_id', v)} placeholder="Cédula, DNI u otro documento" />
          </div>
        </div>
        <div>
          <FieldLabel required>País de residencia actual del padre/madre ausente</FieldLabel>
          <LegalFieldInput value={data.absent_parent_country as string || ''} onChange={v => upd('absent_parent_country', v)} placeholder="Ej: Colombia, Ecuador, EE.UU..." />
        </div>
        <div>
          <FieldLabel>Ciudad/Estado donde reside</FieldLabel>
          <LegalFieldInput value={data.absent_parent_location as string || ''} onChange={v => upd('absent_parent_location', v)} placeholder="Ej: Quito, Ecuador / Port St. Lucie, Florida" />
        </div>
      </Section>

      {/* Sección 4: Hechos de Maltrato */}
      <Section title="Hechos de Maltrato" number={4}>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Esta sección es la más importante para el caso. Describa con el mayor detalle posible: nombres, fechas, lugares y circunstancias.
        </div>
        <div>
          <FieldLabel required>12. ¿Por qué el menor no puede reunificarse con uno o ambos padres?</FieldLabel>
          <TAreaAI question="¿Por qué el menor no puede reunificarse con uno o ambos padres?" value={data.why_cannot_reunify as string || ''} onChange={v => upd('why_cannot_reunify', v)}
            placeholder="Explique las razones por las que el menor no puede volver a vivir con su padre, madre o ambos..." rows={5} />
        </div>
        <div>
          <FieldLabel required>13. Describa en detalle los hechos de abuso, abandono o negligencia que sufrió el menor</FieldLabel>
          <TAreaAI question="Describa en detalle los hechos de abuso, abandono o negligencia" value={data.abuse_description as string || ''} onChange={v => upd('abuse_description', v)}
            placeholder="Cuente todo: golpes, abandono, falta de alimento, maltrato verbal, violencia, negligencia médica... Sea lo más detallado posible." rows={6} />
        </div>
        <div>
          <FieldLabel>14. ¿Quién perpetró el abuso/abandono/negligencia?</FieldLabel>
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
          <FieldLabel>15. ¿Cuándo ocurrieron estos hechos? (fechas aproximadas)</FieldLabel>
          <TInput value={data.when_occurred as string || ''} onChange={v => upd('when_occurred', v)} placeholder="Ej: Desde 2015 hasta 2022 / Toda la infancia" />
        </div>
        <div>
          <FieldLabel>16. ¿Dónde ocurrieron estos hechos?</FieldLabel>
          <TInput value={data.where_occurred as string || ''} onChange={v => upd('where_occurred', v)} placeholder="País de origen, EE.UU., o ambos" />
        </div>
        <div>
          <FieldLabel>17. ¿Existen reportes policiales, médicos, escolares o de trabajadores sociales?</FieldLabel>
          <YesNo value={data.evidence_exists as string || ''} onChange={v => upd('evidence_exists', v)} />
          {data.evidence_exists === 'Sí' && (
            <TArea value={data.evidence_description as string || ''} onChange={v => upd('evidence_description', v)}
              placeholder="Describa qué documentos existen: denuncias, informes médicos, reportes escolares..." rows={3} />
          )}
        </div>
        <div>
          <FieldLabel>18. ¿El menor ha recibido tratamiento médico o psicológico por el maltrato?</FieldLabel>
          <YesNo value={data.minor_treatment as string || ''} onChange={v => upd('minor_treatment', v)} />
          {data.minor_treatment === 'Sí' && (
            <TArea value={data.treatment_description as string || ''} onChange={v => upd('treatment_description', v)}
              placeholder="Describa el tratamiento recibido..." rows={3} />
          )}
        </div>
      </Section>

      {/* Sección 4: Mejor Interés */}
      <Section title="Mejor Interés del Menor" number={5}>
        <div>
          <FieldLabel required>19. ¿Existe riesgo para el menor de ser devuelto a su país de origen? Describa.</FieldLabel>
          <TAreaAI question="¿Existe riesgo para el menor de ser devuelto a su país de origen?" value={data.risk_if_returned as string || ''} onChange={v => upd('risk_if_returned', v)}
            placeholder="Pobreza, violencia, falta de acceso a educación/salud, amenazas, pandillas, falta de familia..." rows={5} />
        </div>
      </Section>

      {/* Sección 5: Proceso Legal */}
      <Section title="Proceso Legal" number={6}>
        <div>
          <FieldLabel>20. ¿El guardián/custodio propuesto tiene antecedentes penales?</FieldLabel>
          <YesNo value={data.guardian_criminal_record as string || ''} onChange={v => upd('guardian_criminal_record', v)} />
        </div>
        <div>
          <FieldLabel>21. ¿El guardián propuesto puede proveer vivienda, alimentación, educación y atención médica?</FieldLabel>
          <TAreaAI question="¿El guardián puede proveer vivienda, alimentación, educación y atención médica?" value={data.guardian_can_provide as string || ''} onChange={v => upd('guardian_can_provide', v)}
            placeholder="Describa cómo el guardián puede cuidar al menor..." rows={3} />
        </div>
        <div>
          <FieldLabel>22. ¿Hay otros miembros del hogar mayores de 18 años?</FieldLabel>
          <TArea value={data.household_members as string || ''} onChange={v => upd('household_members', v)}
            placeholder="Nombres y relación de cada persona mayor de 18 años en el hogar" rows={3} />
        </div>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <FieldLabel>23. ¿Entiende que SIJS NO otorga beneficios migratorios a los padres del menor?</FieldLabel>
          <p className="text-xs text-blue-700 mb-2">
            Importante: La Visa Juvenil (SIJS) es solo para el menor. Los padres NO pueden ser patrocinados a través de este proceso.
          </p>
          <YesNo value={data.understands_sijs as string || ''} onChange={v => upd('understands_sijs', v)} />
        </div>
      </Section>

      {/* Testigos */}
      <Section title="Testigos" number={7}>
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
              <div><FieldLabel required>Nombre</FieldLabel><ValidatedInput value={w.name} onChange={v => { const ws = [...witnesses]; ws[i] = { ...ws[i], name: v }; onChange({ ...data, witnesses: ws }) }} placeholder="Nombre completo" /></div>
              <div><FieldLabel required>Relación</FieldLabel><ValidatedInput value={w.relationship} onChange={v => { const ws = [...witnesses]; ws[i] = { ...ws[i], relationship: v }; onChange({ ...data, witnesses: ws }) }} placeholder="Ej: Hermana, vecina" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel required help="Nacionalidad del testigo. Aparece en la declaración jurada que firmará ante notario.">Nacionalidad</FieldLabel><LegalFieldInput value={(w as any).nationality || ''} onChange={v => { const ws = [...witnesses]; ws[i] = { ...ws[i], nationality: v } as any; onChange({ ...data, witnesses: ws }) }} placeholder="Ej: Colombiana" /></div>
              <div><FieldLabel required help="Pasaporte, cédula, DNI o número de identificación del testigo. Obligatorio para la declaración jurada.">Nº de ID / Cédula</FieldLabel><LegalFieldInput value={(w as any).id_number || ''} onChange={v => { const ws = [...witnesses]; ws[i] = { ...ws[i], id_number: v } as any; onChange({ ...data, witnesses: ws }) }} placeholder="Número de documento" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>Teléfono</FieldLabel><TInput value={w.phone} onChange={v => { const ws = [...witnesses]; ws[i] = { ...ws[i], phone: v }; onChange({ ...data, witnesses: ws }) }} placeholder="Número" /></div>
              <div><FieldLabel>Dirección</FieldLabel><TInput value={w.address} onChange={v => { const ws = [...witnesses]; ws[i] = { ...ws[i], address: v }; onChange({ ...data, witnesses: ws }) }} placeholder="Ciudad, Estado, País" /></div>
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
