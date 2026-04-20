import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'

const log = createLogger('web-push')

let vapidConfigured = false

function configureVapid() {
  if (vapidConfigured) return
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@usalatinoprime.com'
  if (!pub || !priv) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set')
  }
  webpush.setVapidDetails(subject, pub, priv)
  vapidConfigured = true
}

export interface AdminPushPayload {
  title: string
  body: string
  url: string           // path to open on notification click, e.g. "/admin/whatsapp/abc"
  tag?: string          // if repeat pushes share a tag, newer replaces older
  icon?: string
  badge?: string
}

/**
 * Sends a Web Push notification to every admin's registered device.
 * Drops dead subscriptions after 3 consecutive failures.
 *
 * Safe to call from a worker route — configures VAPID lazily and never
 * throws: if push is not configured, we just log and return.
 */
export async function sendPushToAdmins(payload: AdminPushPayload): Promise<{
  sent: number
  failed: number
  removed: number
}> {
  try {
    configureVapid()
  } catch (err) {
    log.warn('VAPID not configured — skipping push', err)
    return { sent: 0, failed: 0, removed: 0 }
  }

  const supabase = createServiceClient()

  // Find all admin user IDs and collect their push subscriptions.
  const { data: admins, error: adminErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
  if (adminErr || !admins || admins.length === 0) {
    log.warn('no admins to notify', adminErr)
    return { sent: 0, failed: 0, removed: 0 }
  }

  const adminIds = admins.map(a => a.id as string)
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', adminIds)

  if (!subs || subs.length === 0) {
    log.info('no push subscriptions registered')
    return { sent: 0, failed: 0, removed: 0 }
  }

  const json = JSON.stringify(payload)
  let sent = 0
  let failed = 0
  let removed = 0

  for (const sub of subs) {
    const subscription = {
      endpoint: sub.endpoint as string,
      keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
    }
    try {
      await webpush.sendNotification(subscription, json)
      sent++
      await supabase
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString(), failed_count: 0 })
        .eq('id', sub.id as string)
    } catch (err: unknown) {
      failed++
      const statusCode = (err as { statusCode?: number })?.statusCode
      // 404 Not Found, 410 Gone → subscription is dead, remove it.
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id as string)
        removed++
      } else {
        const failedCount = ((sub.failed_count as number | null) ?? 0) + 1
        if (failedCount >= 3) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id as string)
          removed++
        } else {
          await supabase
            .from('push_subscriptions')
            .update({ failed_count: failedCount })
            .eq('id', sub.id as string)
        }
      }
      log.warn('push failed', { statusCode, err })
    }
  }

  return { sent, failed, removed }
}
