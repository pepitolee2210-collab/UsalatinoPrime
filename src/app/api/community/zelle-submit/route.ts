import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('screenshot') as File

  if (!file) {
    return NextResponse.json({ error: 'Debe subir el comprobante' }, { status: 400 })
  }

  // Upload screenshot to Supabase Storage
  const fileExt = file.name.split('.').pop()
  const fileName = `${user.id}/${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('zelle-screenshots')
    .upload(fileName, file, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: 'Error al subir el comprobante' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('zelle-screenshots')
    .getPublicUrl(fileName)

  // Create zelle payment record
  const { error: insertError } = await supabase
    .from('zelle_payments')
    .insert({
      user_id: user.id,
      amount: 25,
      screenshot_url: publicUrl,
      status: 'pending',
    })

  if (insertError) {
    return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 })
  }

  // Ensure membership record exists
  await supabase
    .from('community_memberships')
    .upsert({
      user_id: user.id,
      status: 'free',
      payment_method: 'zelle',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id', ignoreDuplicates: true })

  // Notify admin
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)

  if (admins && admins.length > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()

    const name = profile ? `${profile.first_name} ${profile.last_name}` : 'Un usuario'

    await supabase.from('notifications').insert({
      user_id: admins[0].id,
      title: 'Nuevo Pago Zelle Pendiente',
      message: `${name} envió un comprobante de Zelle por $25 para la comunidad. Revise y apruebe.`,
      type: 'payment',
    })
  }

  return NextResponse.json({ success: true })
}
