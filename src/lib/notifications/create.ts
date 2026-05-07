import { createClient } from '@/lib/supabase/server'

interface CreateNotificationParams {
  userId: string
  caseId?: string
  title: string
  message: string
  type?: 'info' | 'warning' | 'success' | 'payment' | 'action_required'
  sendEmail?: boolean
}

export async function createNotification({
  userId,
  caseId,
  title,
  message,
  type = 'info',
  sendEmail = false,
}: CreateNotificationParams) {
  const supabase = await createClient()

  // Create in-app notification
  const { data, error } = await supabase.from('notifications').insert({
    user_id: userId,
    case_id: caseId,
    title,
    message,
    type,
  }).select().single()

  if (error) {
    console.error('Error creating notification:', error)
    return null
  }

  // Optionally send email
  if (sendEmail) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, first_name')
        .eq('id', userId)
        .single()

      if (profile?.email) {
        const { sendEmail: sendEmailFn } = await import('@/lib/email/send')
        await sendEmailFn({
          to: profile.email,
          subject: title,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #002855;">UsaLatinoPrime</h2>
              <p>Hola ${profile.first_name},</p>
              <p>${message}</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="color: #6b7280; font-size: 14px;">
                Para acceder a tu caso, ingresa con tu teléfono en
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/cita">app.usalatinoprime.com/cita</a>.
              </p>
            </div>
          `,
        })
      }
    } catch (emailError) {
      console.error('Error sending email notification:', emailError)
    }
  }

  return data
}
