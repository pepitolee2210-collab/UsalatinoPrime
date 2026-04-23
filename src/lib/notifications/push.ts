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

export interface StaffPushPayload {
  title: string
  body: string
  /**
   * Either a static url, or a function that builds the url for each role.
   * When the target is a WhatsApp conversation, pass the function form so
   * admins go to `/admin/whatsapp/...` and senior consultants to
   * `/employee/whatsapp/...`.
   */
  url: string | ((role: 'admin' | 'senior_consultant') => string)
  tag?: string          // if repeat pushes share a tag, newer replaces older
  icon?: string
  badge?: string
}

/** @deprecated Kept for backwards compatibility — use StaffPushPayload. */
export type AdminPushPayload = StaffPushPayload

type StaffRow = { id: string; role: 'admin' | 'senior_consultant' }

/**
 * Sends a Web Push notification to every registered device of the staff
 * that handles SIJS WhatsApp leads: admins (Henry) and senior consultants
 * (Vanessa). Drops dead subscriptions after 3 consecutive failures.
 *
 * Safe to call from a worker route — configures VAPID lazily and never
 * throws: if push is not configured, we just log and return.
 */
export async function sendPushToStaff(payload: StaffPushPayload): Promise<{
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

  const [adminsRes, consultantsRes] = await Promise.all([
    supabase.from('profiles').select('id').eq('role', 'admin'),
    supabase
      .from('profiles')
      .select('id')
      .eq('role', 'employee')
      .eq('employee_type', 'senior_consultant'),
  ])
  const staff: StaffRow[] = [
    ...((adminsRes.data ?? []) as Array<{ id: string }>).map(r => ({
      id: r.id,
      role: 'admin' as const,
    })),
    ...((consultantsRes.data ?? []) as Array<{ id: string }>).map(r => ({
      id: r.id,
      role: 'senior_consultant' as const,
    })),
  ]
  if (staff.length === 0) {
    log.warn('no staff to notify', adminsRes.error ?? consultantsRes.error)
    return { sent: 0, failed: 0, removed: 0 }
  }

  const roleById = new Map(staff.map(s => [s.id, s.role]))

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', Array.from(roleById.keys()))

  if (!subs || subs.length === 0) {
    log.info('no push subscriptions registered')
    return { sent: 0, failed: 0, removed: 0 }
  }

  const urlFor = (role: 'admin' | 'senior_consultant'): string =>
    typeof payload.url === 'function' ? payload.url(role) : payload.url

  let sent = 0
  let failed = 0
  let removed = 0

  for (const sub of subs) {
    const role = roleById.get(sub.user_id as string)
    if (!role) continue

    const subscription = {
      endpoint: sub.endpoint as string,
      keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
    }
    const rolePayload = {
      title: payload.title,
      body: payload.body,
      url: urlFor(role),
      tag: payload.tag,
      icon: payload.icon,
      badge: payload.badge,
    }
    try {
      await webpush.sendNotification(subscription, JSON.stringify(rolePayload))
      sent++
      await supabase
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString(), failed_count: 0 })
        .eq('id', sub.id as string)
    } catch (err: unknown) {
      failed++
      const statusCode = (err as { statusCode?: number })?.statusCode
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

/** @deprecated Renamed to sendPushToStaff — kept as alias to avoid breaking imports. */
export const sendPushToAdmins = sendPushToStaff
