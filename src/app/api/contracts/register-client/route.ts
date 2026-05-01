import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { triggerJurisdictionResearchAsync } from '@/lib/legal/trigger-research-async'
import type { CasePhase } from '@/types/database'

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

/**
 * Mapea servicio + subservicio elegidos en el contrato a la fase inicial del
 * caso. Solo Visa Juvenil (SIJS) usa el sistema de fases. Para el resto se
 * devuelve null en ambos campos.
 */
function resolveStartingPhase(
  serviceSlug: string,
  subserviceSlug: string | null,
): CasePhase | null {
  if (serviceSlug !== 'visa-juvenil') return null
  switch (subserviceSlug) {
    case 'i485':
      return 'i485'
    case 'i360':
    case 'i360-i485':
      return 'i360'
    // 'completa' o null → todo el proceso, arranca en custodia
    default:
      return 'custodia'
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify caller is admin
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const service = createServiceClient()

    const { data: profile } = await service
      .from('profiles')
      .select('role, employee_type')
      .eq('id', user.id)
      .single()

    // Admin o contracts_manager (Andrium). Antes solo admin podía registrar
    // el cliente y Andrium tenía contratos creados sin profile/case/token —
    // por eso el cliente no podía entrar al portal /cita con su número.
    const isAdmin = profile?.role === 'admin'
    const isContractsManager = profile?.role === 'employee' && profile?.employee_type === 'contracts_manager'
    if (!isAdmin && !isContractsManager) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const {
      contract_id,
      client_full_name,
      client_passport,
      client_phone,
      service_slug,
      subservice_slug,
      total_price,
    } = body

    const startingPhase = resolveStartingPhase(service_slug, subservice_slug ?? null)

    if (!client_full_name || !client_passport || !client_phone || !service_slug) {
      return NextResponse.json(
        { error: 'Campos requeridos: client_full_name, client_passport, client_phone, service_slug' },
        { status: 400 }
      )
    }

    const normalized = normalizePhone(client_phone)
    if (normalized.length < 7 || normalized.length > 15) {
      return NextResponse.json({ error: 'Número de teléfono inválido' }, { status: 400 })
    }

    // Parse name into first/last and normalize to Title Case
    function toTitleCase(str: string): string {
      return str.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase())
    }
    const nameParts = client_full_name.trim().split(/\s+/)
    const firstName = toTitleCase(nameParts[0])
    const lastName = toTitleCase(nameParts.slice(1).join(' ') || nameParts[0])

    // Step 1: Check if profile already exists by phone
    let clientId: string | null = null

    const { data: profiles } = await service
      .from('profiles')
      .select('id, phone')
      .eq('role', 'client')

    const matchedProfile = (profiles || []).find(p => {
      if (!p.phone) return false
      return normalizePhone(p.phone) === normalized
    })

    if (matchedProfile) {
      clientId = matchedProfile.id
    } else {
      // Step 2: Create Auth user (trigger auto-creates profile)
      const passportNormalized = client_passport.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      const email = `${passportNormalized}@clientes.usalatino.internal`
      const password = crypto.randomUUID()

      const { data: newUser, error: createError } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          phone: client_phone.trim(),
        },
      })

      if (createError) {
        // If email already exists (same passport), find and reuse
        if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
          const { data: existingUsers } = await service.auth.admin.listUsers()
          const existing = existingUsers?.users?.find(u => u.email === email)
          if (existing) {
            clientId = existing.id
          } else {
            return NextResponse.json(
              { error: 'Error al crear usuario: ' + createError.message },
              { status: 500 }
            )
          }
        } else {
          return NextResponse.json(
            { error: 'Error al crear usuario: ' + createError.message },
            { status: 500 }
          )
        }
      } else {
        clientId = newUser.user.id
      }
    }

    if (!clientId) {
      return NextResponse.json({ error: 'No se pudo obtener el client_id' }, { status: 500 })
    }

    // Always sync phone and name on the profile (handles edits and missing data)
    await service
      .from('profiles')
      .update({
        phone: client_phone.trim(),
        first_name: firstName,
        last_name: lastName,
      })
      .eq('id', clientId)

    // Step 3: Find service in catalog
    const { data: serviceCatalog } = await service
      .from('service_catalog')
      .select('id')
      .eq('slug', service_slug)
      .single()

    if (!serviceCatalog) {
      return NextResponse.json(
        { error: `Servicio no encontrado: ${service_slug}` },
        { status: 404 }
      )
    }

    // Step 4: Check if case already exists for this client + service
    const { data: existingCase } = await service
      .from('cases')
      .select('id, case_number')
      .eq('client_id', clientId)
      .eq('service_id', serviceCatalog.id)
      .limit(1)
      .maybeSingle()

    let caseId: string
    let caseNumber: string

    if (existingCase) {
      // Reuse existing case, just update total_cost if changed.
      // Si todavía no tenía fase asignada y el contrato indica una, la fijamos.
      caseId = existingCase.id
      caseNumber = existingCase.case_number
      const updatePayload: Record<string, unknown> = {}
      if (total_price) updatePayload.total_cost = total_price
      if (startingPhase) {
        const { data: existingPhases } = await service
          .from('cases')
          .select('current_phase, process_start')
          .eq('id', existingCase.id)
          .single()
        if (existingPhases && !existingPhases.process_start) {
          updatePayload.process_start = startingPhase
        }
        if (existingPhases && !existingPhases.current_phase) {
          updatePayload.current_phase = startingPhase
        }
      }
      if (Object.keys(updatePayload).length > 0) {
        await service
          .from('cases')
          .update(updatePayload)
          .eq('id', existingCase.id)
      }
    } else {
      // Create new case
      const insertPayload: Record<string, unknown> = {
        client_id: clientId,
        service_id: serviceCatalog.id,
        total_cost: total_price || 0,
        intake_status: 'in_progress',
        form_data: {},
        current_step: 0,
      }
      if (startingPhase) {
        insertPayload.process_start = startingPhase
        insertPayload.current_phase = startingPhase
      }
      const { data: newCase, error: caseError } = await service
        .from('cases')
        .insert(insertPayload)
        .select('id, case_number')
        .single()

      if (caseError) {
        console.error('Error creating case:', caseError)
        if (contract_id) {
          await service
            .from('contracts')
            .update({ client_id: clientId })
            .eq('id', contract_id)
        }
        return NextResponse.json({
          client_id: clientId,
          case_id: null,
          case_number: null,
          warning: 'Cliente registrado pero hubo error al crear el caso',
        })
      }
      caseId = newCase.id
      caseNumber = newCase.case_number
    }

    // Step 5: Update contract with client_id
    if (contract_id) {
      await service
        .from('contracts')
        .update({ client_id: clientId })
        .eq('id', contract_id)
    }

    // Step 6: Auto-disparar research de jurisdicción para visa juvenil.
    // Corre en background — el user ve contrato creado de inmediato y el panel
    // de jurisdicción en /admin/cases/[id] hace polling hasta que termine.
    // NO bloquea el response. Solo para SIJS.
    if (service_slug === 'visa-juvenil') {
      try {
        const result = await triggerJurisdictionResearchAsync(caseId, service)
        console.log('[register-client] jurisdiction research trigger:', result)
      } catch (err) {
        // Nunca fallar el register por un problema del trigger.
        console.error('[register-client] trigger error (ignorado):', err)
      }
    }

    return NextResponse.json({
      client_id: clientId,
      case_id: caseId,
      case_number: caseNumber,
    })
  } catch (err) {
    console.error('register-client error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
