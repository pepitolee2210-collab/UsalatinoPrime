import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const renunciaSchema = z.object({
  // Datos del firmante (mapped to mother/father fields)
  mother_full_name: z.string().min(2, 'Nombre completo requerido'),
  mother_nationality: z.string().min(1, 'Nacionalidad requerida'),
  mother_dni: z.string().min(1, 'DNI requerido'),
  mother_address: z.string().min(1, 'Direccion requerida'),

  // Datos del hijo/a
  daughter_full_name: z.string().min(2, 'Nombre completo requerido'),
  daughter_dob: z.string().min(1, 'Fecha de nacimiento requerida'),
  daughter_birth_certificate_municipality: z.string().min(1, 'Municipalidad requerida'),

  // Datos del custodio
  father_full_name: z.string().min(2, 'Nombre completo requerido'),
  father_passport: z.string().min(1, 'Pasaporte requerido'),
  father_country_state: z.string().min(1, 'Estado requerido'),
  father_address_with_daughter: z.string().min(1, 'Direccion requerida'),

  // New document config fields
  guardianship_state: z.string().min(1, 'Estado de custodia requerido'),
  signer_role: z.enum(['mother', 'father']),
  child_gender: z.enum(['daughter', 'son']),
  country_left: z.string().min(1, 'País requerido'),
  caregiver_since_year: z.string().min(1, 'Año requerido'),
  signing_city: z.string().min(1, 'Ciudad de firma requerida'),
  additional_children: z.array(z.object({
    full_name: z.string(),
    dob: z.string(),
    birth_certificate_municipality: z.string(),
  })).optional().default([]),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = renunciaSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos invalidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('renuncia_submissions')
      .insert({
        mother_full_name: parsed.data.mother_full_name,
        mother_nationality: parsed.data.mother_nationality,
        mother_dni: parsed.data.mother_dni,
        mother_address: parsed.data.mother_address,
        daughter_full_name: parsed.data.daughter_full_name,
        daughter_dob: parsed.data.daughter_dob,
        daughter_birth_certificate_municipality: parsed.data.daughter_birth_certificate_municipality,
        father_full_name: parsed.data.father_full_name,
        father_passport: parsed.data.father_passport,
        father_country_state: parsed.data.father_country_state,
        father_address_with_daughter: parsed.data.father_address_with_daughter,
        guardianship_state: parsed.data.guardianship_state,
        signer_role: parsed.data.signer_role,
        child_gender: parsed.data.child_gender,
        country_left: parsed.data.country_left,
        caregiver_since_year: parsed.data.caregiver_since_year,
        signing_city: parsed.data.signing_city,
        additional_children: parsed.data.additional_children,
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
