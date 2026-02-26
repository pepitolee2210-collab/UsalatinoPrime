import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const cambioCorteSchema = z.object({
  client_full_name: z.string().min(2, 'Nombre completo requerido'),
  client_phone: z.string().min(1, 'Telefono requerido'),
  client_address_street: z.string().min(1, 'Direccion requerida'),
  client_address_city: z.string().min(1, 'Ciudad requerida'),
  client_address_state: z.string().min(1, 'Estado requerido'),
  client_address_zip: z.string().min(1, 'Codigo postal requerido'),

  file_number: z.string().min(1, 'Numero A# requerido'),
  judge_name: z.string().min(1, 'Nombre del juez requerido'),
  next_hearing_date: z.string().min(1, 'Fecha de audiencia requerida'),
  next_hearing_time: z.string().min(1, 'Hora de audiencia requerida'),

  current_court_name: z.string().min(1, 'Nombre de la corte actual requerido'),
  current_court_street: z.string().min(1, 'Direccion de la corte actual requerida'),
  current_court_city_state_zip: z.string().min(1, 'Ciudad/estado/zip de la corte actual requerido'),

  new_address_street: z.string().min(1, 'Nueva direccion requerida'),
  new_address_city: z.string().min(1, 'Nueva ciudad requerida'),
  new_address_state: z.string().min(1, 'Nuevo estado requerido'),
  new_address_zip: z.string().min(1, 'Nuevo codigo postal requerido'),
  new_court_name: z.string().min(1, 'Nombre de la nueva corte requerido'),
  new_court_street: z.string().min(1, 'Direccion de la nueva corte requerida'),
  new_court_city_state_zip: z.string().min(1, 'Ciudad/estado/zip de la nueva corte requerido'),

  chief_counsel_address: z.string().min(1, 'Direccion del fiscal requerida'),
  document_date: z.string().min(1, 'Fecha del documento requerida'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = cambioCorteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos invalidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('cambio_corte_submissions')
      .insert(parsed.data)

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { error: 'Error al guardar el formulario' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Formulario guardado exitosamente' },
      { status: 201 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    )
  }
}
