import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const renunciaSchema = z.object({
  // Datos de la madre
  mother_full_name: z.string().min(2, 'Nombre completo de la madre requerido'),
  mother_nationality: z.string().min(1, 'Nacionalidad de la madre requerida'),
  mother_dni: z.string().min(1, 'DNI de la madre requerido'),
  mother_address: z.string().min(1, 'Direccion de la madre requerida'),

  // Datos de la hija
  daughter_full_name: z.string().min(2, 'Nombre completo de la hija requerido'),
  daughter_dob: z.string().min(1, 'Fecha de nacimiento de la hija requerida'),
  daughter_birth_certificate_municipality: z.string().min(1, 'Municipalidad del acta de nacimiento requerida'),

  // Datos del padre
  father_full_name: z.string().min(2, 'Nombre completo del padre requerido'),
  father_passport: z.string().min(1, 'Pasaporte del padre requerido'),
  father_country_state: z.string().min(1, 'Estado/pais del padre requerido'),
  father_address_with_daughter: z.string().min(1, 'Direccion del padre con la hija requerida'),
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
