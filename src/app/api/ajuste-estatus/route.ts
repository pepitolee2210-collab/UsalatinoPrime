import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const ajusteSchema = z.object({
  // Section 1: Personal
  legal_last_name: z.string().min(2, 'Apellido requerido'),
  legal_first_name: z.string().min(2, 'Nombre requerido'),
  legal_middle_name: z.string().default(''),
  other_names: z.array(z.string()).default([]),
  date_of_birth: z.string().min(1, 'Fecha de nacimiento requerida'),
  city_of_birth: z.string().min(1, 'Ciudad requerida'),
  country_of_birth: z.string().min(1, 'Pais requerido'),
  nationality: z.string().min(1, 'Nacionalidad requerida'),
  gender: z.string().min(1, 'Sexo requerido'),
  marital_status: z.string().min(1, 'Estado civil requerido'),
  ssn: z.string().default(''),
  a_number: z.string().default(''),
  uscis_online_account: z.string().default(''),
  residence_address_street: z.string().min(1, 'Direccion requerida'),
  residence_address_city: z.string().min(1, 'Ciudad requerida'),
  residence_address_state: z.string().min(1, 'Estado requerido'),
  residence_address_zip: z.string().min(1, 'Codigo postal requerido'),
  residence_phone: z.string().min(1, 'Telefono requerido'),
  email: z.string().default(''),

  // Section 2: Immigration
  current_immigration_status: z.string().min(1, 'Estatus requerido'),
  current_status_other: z.string().default(''),
  date_of_last_entry: z.string().min(1, 'Fecha de entrada requerida'),
  place_of_last_entry: z.string().min(1, 'Lugar de entrada requerido'),
  i94_number: z.string().default(''),
  passport_number: z.string().default(''),
  passport_country: z.string().default(''),
  passport_expiry: z.string().default(''),
  entry_status_at_arrival: z.string().default(''),
  current_status_expires: z.string().default(''),
  ever_in_removal_proceedings: z.boolean().default(false),
  removal_proceedings_details: z.string().default(''),
  ever_denied_visa_or_entry: z.boolean().default(false),
  denial_details: z.string().default(''),

  // Section 3: Petitioner
  petitioner_type: z.string().min(1, 'Tipo de peticionario requerido'),
  petitioner_full_name: z.string().min(1, 'Nombre del peticionario requerido'),
  petitioner_relationship: z.string().min(1, 'Relacion requerida'),
  petitioner_a_number: z.string().default(''),
  petitioner_date_of_birth: z.string().default(''),
  petitioner_country_of_birth: z.string().default(''),
  petition_receipt_number: z.string().default(''),
  petition_priority_date: z.string().default(''),
  petition_category: z.string().default(''),

  // Section 4: Family
  has_spouse: z.boolean().default(false),
  spouse_info: z.object({
    spouse_full_name: z.string().default(''),
    spouse_dob: z.string().default(''),
    spouse_country_of_birth: z.string().default(''),
    spouse_a_number: z.string().default(''),
    spouse_immigration_status: z.string().default(''),
    spouse_included_in_application: z.boolean().default(false),
    marriage_date: z.string().default(''),
    marriage_city: z.string().default(''),
    marriage_state: z.string().default(''),
  }).optional(),
  has_children: z.boolean().default(false),
  children: z.array(z.object({
    child_full_name: z.string().default(''),
    child_dob: z.string().default(''),
    child_country_of_birth: z.string().default(''),
    child_a_number: z.string().default(''),
    child_in_us: z.boolean().default(false),
    child_included: z.boolean().default(false),
  })).default([]),

  // Section 5: Employment/Education
  employments: z.array(z.object({
    emp_employer: z.string().default(''),
    emp_address: z.string().default(''),
    emp_city: z.string().default(''),
    emp_state: z.string().default(''),
    emp_occupation: z.string().default(''),
    emp_from: z.string().default(''),
    emp_to: z.string().default(''),
  })).default([]),
  education: z.array(z.object({
    edu_school: z.string().default(''),
    edu_type: z.string().default(''),
    edu_address: z.string().default(''),
    edu_from: z.string().default(''),
    edu_to: z.string().default(''),
  })).default([]),

  // Section 6: Admissibility
  criminal_arrest: z.boolean().default(false),
  criminal_details: z.string().default(''),
  criminal_conviction: z.boolean().default(false),
  conviction_details: z.string().default(''),
  drug_related: z.boolean().default(false),
  drug_details: z.string().default(''),
  immigration_fraud: z.boolean().default(false),
  fraud_details: z.string().default(''),
  false_us_citizen: z.boolean().default(false),
  citizen_details: z.string().default(''),
  removed_deported: z.boolean().default(false),
  deported_details: z.string().default(''),
  unlawful_presence: z.boolean().default(false),
  unlawful_details: z.string().default(''),
  public_charge: z.boolean().default(false),
  public_charge_details: z.string().default(''),

  // Section 7: Documents
  has_medical_exam: z.boolean().default(false),
  has_affidavit_support: z.boolean().default(false),
  additional_info: z.string().default(''),
  applicant_declaration: z.boolean().refine(v => v === true, 'Debe aceptar la declaracion'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = ajusteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos invalidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('ajuste_submissions')
      .insert({
        applicant_name: `${parsed.data.legal_first_name} ${parsed.data.legal_last_name}`,
        country_of_birth: parsed.data.country_of_birth,
        form_data: parsed.data,
      })

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { error: 'Error al guardar el formulario' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Formulario enviado exitosamente' },
      { status: 201 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    )
  }
}
