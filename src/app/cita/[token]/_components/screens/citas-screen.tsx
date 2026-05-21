'use client'

import type { Appointment } from '@/types/database'
import type { TzSource } from '@/lib/appointments/resolve-tz'
import { AppointmentBooking } from '../../appointment-booking'

interface CitasScreenProps {
  token: string
  appointments: Appointment[]
  zoomLink: string
  initialTimezone: string
  initialTimezoneSource: TzSource
}

/**
 * Wrapper visual de AppointmentBooking. La lógica de slots, penalty,
 * book y cancel se mantiene intacta — solo se le da el chrome del
 * nuevo design system.
 */
export function CitasScreen({
  token,
  appointments,
  zoomLink,
  initialTimezone,
  initialTimezoneSource,
}: CitasScreenProps) {
  return (
    <div className="ulp-screen px-6 py-6 space-y-6 max-w-2xl mx-auto">
      <header>
        <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
          Tus citas
        </p>
        <h1
          className="ulp-h2 italic mt-1"
          style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}
        >
          Agendar tu cita
        </h1>
        <p
          className="ulp-body-md mt-2"
          style={{ color: 'var(--color-ulp-on-surface-variant)' }}
        >
          Reserva un horario con tu asesora legal. Las citas se realizan por Zoom.
        </p>
      </header>

      <section
        className="rounded-2xl border p-5"
        style={{
          background: 'var(--color-ulp-surface-container-lowest)',
          borderColor: 'var(--color-ulp-outline-variant)',
        }}
      >
        <AppointmentBooking
          token={token}
          appointments={appointments}
          zoomLink={zoomLink}
          initialTimezone={initialTimezone}
          initialTimezoneSource={initialTimezoneSource}
        />
      </section>
    </div>
  )
}
