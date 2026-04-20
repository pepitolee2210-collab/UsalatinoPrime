'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

/**
 * Admin-only page to enable/disable Web Push notifications on *this* device.
 *
 * Flow:
 *   1. Register /admin-push-sw.js at scope /admin/.
 *   2. Ask the browser for Notification permission.
 *   3. Call pushManager.subscribe() with the VAPID public key.
 *   4. POST the subscription to /api/notifications/push/subscribe.
 */

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(b64: string) {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}

export default function NotificationsSettingsPage() {
  const [supported, setSupported] = useState<boolean>(true)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false)
      return
    }
    setPermission(Notification.permission)
    // Check if already subscribed
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration('/admin/')
        if (!reg) return
        const sub = await reg.pushManager.getSubscription()
        setSubscribed(!!sub)
      } catch {
        // ignore
      }
    })()
  }, [])

  async function enable() {
    if (!VAPID_PUBLIC) {
      toast.error('VAPID public key no configurada en el servidor.')
      return
    }
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.register('/admin-push-sw.js', {
        scope: '/admin/',
      })
      await navigator.serviceWorker.ready

      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        toast.error('Permiso de notificaciones denegado.')
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })

      const res = await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sub.toJSON(),
          deviceLabel: navigator.userAgent.slice(0, 200),
        }),
      })
      if (!res.ok) throw new Error('Failed to save subscription')
      setSubscribed(true)
      toast.success('Notificaciones activadas en este dispositivo.')
    } catch (err) {
      console.error(err)
      toast.error('No se pudo activar las notificaciones.')
    } finally {
      setLoading(false)
    }
  }

  async function disable() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/admin/')
      if (!reg) return
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/notifications/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      toast.success('Notificaciones desactivadas.')
    } catch (err) {
      console.error(err)
      toast.error('Error al desactivar notificaciones.')
    } finally {
      setLoading(false)
    }
  }

  if (!supported) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Notificaciones Push</h1>
        <p className="text-muted-foreground">
          Este navegador no soporta notificaciones push. Usa Chrome, Edge, Firefox
          o Safari 16.4+.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notificaciones Push</h1>
        <p className="text-muted-foreground mt-1">
          Recibe notificaciones cuando se agende una nueva cita SIJS por WhatsApp,
          incluso con el celular bloqueado o la app cerrada.
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Estado en este dispositivo</div>
            <div className="text-sm text-muted-foreground">
              Permiso: <span className="font-mono">{permission}</span>
              {' • '}
              Suscripción: <span className="font-mono">{subscribed ? 'activa' : 'inactiva'}</span>
            </div>
          </div>
          {subscribed ? (
            <Button onClick={disable} disabled={loading} variant="outline">
              Desactivar
            </Button>
          ) : (
            <Button onClick={enable} disabled={loading}>
              Activar
            </Button>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Para PWA en iOS: primero instala la app en la pantalla de inicio (Share → Añadir
        a pantalla de inicio) y recién entonces podrás aceptar notificaciones.
      </div>
    </div>
  )
}
