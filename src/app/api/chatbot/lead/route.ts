import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  try {
    const { name, phone, service_interest, situation_summary } = await request.json()

    if (!name?.trim() || !phone?.trim()) {
      return Response.json({ error: 'Nombre y teléfono requeridos' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Check for duplicate open records
    const cleanPhone = phone.trim().replace(/\D/g, '')
    const { data: existing } = await supabase
      .from('callback_requests')
      .select('id, prospect_name')
      .or(`phone.eq.${phone.trim()},phone.ilike.%${cleanPhone.slice(-10)}%`)
      .not('status', 'in', '("not_interested","closed")')
      .limit(1)

    if (existing && existing.length > 0) {
      return Response.json({
        success: true,
        message: 'Ya teníamos tu información. Henry te contactará pronto.',
        id: existing[0].id,
      })
    }

    const { data, error } = await supabase
      .from('callback_requests')
      .insert({
        prospect_name: name.trim(),
        phone: phone.trim(),
        service_interest: service_interest?.trim() || 'consulta-general',
        notes: situation_summary
          ? `[Chatbot] ${situation_summary.trim()}`
          : '[Chatbot] Prospecto registrado desde el chatbot',
        source: 'chatbot',
        message_date: new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single()

    if (error) {
      return Response.json({ error: 'Error al registrar' }, { status: 500 })
    }

    return Response.json({
      success: true,
      message: '¡Registrado! Henry te contactará pronto.',
      id: data.id,
    }, { status: 201 })
  } catch {
    return Response.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
