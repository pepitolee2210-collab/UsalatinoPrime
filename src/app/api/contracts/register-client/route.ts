import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { triggerJurisdictionResearchAsync } from '@/lib/legal/trigger-research-async'
import { normalizePhone, isValidPhoneLength, syntheticClientEmail } from '@/lib/phone'
import { createCaseForContract } from '@/lib/cases/create-case'
import { resolveStartingPhase } from '@/lib/contracts/starting-phase'

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
}

export async function POST(request: NextRequest) {
  try {
    // Verify caller is admin o contracts_manager.
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

    const isAdmin = profile?.role === 'admin'
    const isContractsManager =
      profile?.role === 'employee' && profile?.employee_type === 'contracts_manager'
    const isSeniorConsultant =
      profile?.role === 'employee' && profile?.employee_type === 'senior_consultant'
    if (!isAdmin && !isContractsManager && !isSeniorConsultant) {
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

    if (!contract_id) {
      return NextResponse.json(
        { error: 'contract_id requerido' },
        { status: 400 },
      )
    }
    if (!client_full_name || !client_phone || !service_slug) {
      return NextResponse.json(
        { error: 'Campos requeridos: client_full_name, client_phone, service_slug' },
        { status: 400 },
      )
    }

    const normalizedPhone = normalizePhone(client_phone)
    if (!isValidPhoneLength(normalizedPhone)) {
      return NextResponse.json(
        { error: 'Número de teléfono inválido' },
        { status: 400 },
      )
    }

    const startingPhase = resolveStartingPhase(service_slug, subservice_slug ?? null)

    // ─────────────────────────────────────────────────────────────────
    // Idempotencia: si el contrato ya está vinculado a un case, devolverlo
    // sin tocar nada. Re-ejecutar register-client jamás debe duplicar.
    // ─────────────────────────────────────────────────────────────────
    const { data: existingContract } = await service
      .from('contracts')
      .select('id, case_id, client_id')
      .eq('id', contract_id)
      .single()

    if (!existingContract) {
      return NextResponse.json(
        { error: 'Contrato no encontrado' },
        { status: 404 },
      )
    }

    if (existingContract.case_id) {
      const { data: existingCase } = await service
        .from('cases')
        .select('case_number')
        .eq('id', existingContract.case_id)
        .single()
      return NextResponse.json({
        client_id: existingContract.client_id,
        case_id: existingContract.case_id,
        case_number: existingCase?.case_number ?? null,
        already_registered: true,
      })
    }

    // ─────────────────────────────────────────────────────────────────
    // 1. Identificar al cliente por teléfono normalizado (única fuente).
    // ─────────────────────────────────────────────────────────────────
    const nameParts = client_full_name.trim().split(/\s+/)
    const firstName = toTitleCase(nameParts[0])
    const lastName = toTitleCase(nameParts.slice(1).join(' ') || nameParts[0])

    const { data: matched, error: rpcError } = await service.rpc(
      'find_client_by_phone',
      { p_phone: client_phone },
    )

    if (rpcError) {
      console.error('[register-client] find_client_by_phone error:', rpcError)
      return NextResponse.json(
        { error: 'Error al buscar cliente: ' + rpcError.message },
        { status: 500 },
      )
    }

    const matchedProfile = Array.isArray(matched) && matched.length > 0 ? matched[0] : null
    let clientId: string

    if (matchedProfile) {
      clientId = matchedProfile.id

      // Sincronizar nombres SOLO si el profile estaba vacío. Nunca sobrescribir
      // datos existentes ciegamente — eso fue parte del bug de Jose Luis.
      const updates: Record<string, string> = {}
      if (!matchedProfile.first_name?.trim()) updates.first_name = firstName
      if (!matchedProfile.last_name?.trim()) updates.last_name = lastName
      if (Object.keys(updates).length > 0) {
        await service.from('profiles').update(updates).eq('id', clientId)
      }
    } else {
      // Crear auth.user con email sintético basado en PHONE (no passport).
      const email = syntheticClientEmail(normalizedPhone)
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

      if (createError || !newUser?.user) {
        // Si el email ya existe (un cliente legacy con phone normalizado igual
        // pero almacenado distinto), buscar por email de forma transparente.
        if (
          createError?.message?.includes('already been registered') ||
          createError?.message?.includes('already exists')
        ) {
          const { data: existingUsers } = await service.auth.admin.listUsers()
          const existing = existingUsers?.users?.find((u) => u.email === email)
          if (existing) {
            clientId = existing.id
          } else {
            return NextResponse.json(
              { error: 'Conflicto creando cuenta: ' + createError.message },
              { status: 500 },
            )
          }
        } else {
          return NextResponse.json(
            { error: 'Error al crear usuario: ' + (createError?.message ?? 'unknown') },
            { status: 500 },
          )
        }
      } else {
        clientId = newUser.user.id
      }
    }

    // Guardar passport en notes solo si está disponible (referencia, no identidad).
    if (client_passport?.trim()) {
      await service
        .from('profiles')
        .update({ passport_number: client_passport.trim() })
        .eq('id', clientId)
        .is('passport_number', null) // solo si estaba vacío, no sobrescribir
    }

    // ─────────────────────────────────────────────────────────────────
    // 2. Resolver service del catálogo.
    // ─────────────────────────────────────────────────────────────────
    const { data: serviceCatalog } = await service
      .from('service_catalog')
      .select('id')
      .eq('slug', service_slug)
      .single()

    if (!serviceCatalog) {
      return NextResponse.json(
        { error: `Servicio no encontrado: ${service_slug}` },
        { status: 404 },
      )
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. Crear case NUEVO siempre (1 contrato = 1 case, no se deduplica).
    //    Usamos el helper centralizado en `lib/cases/create-case` que
    //    también vincula bidireccionalmente contrato ↔ case.
    // ─────────────────────────────────────────────────────────────────
    let newCase: { id: string; case_number: string }
    try {
      newCase = await createCaseForContract(
        {
          contractId: contract_id,
          clientId,
          serviceId: serviceCatalog.id,
          totalCost: total_price || 0,
          startingPhase,
        },
        service,
      )
    } catch (err) {
      console.error('[register-client] Error creating case:', err)
      // Vincular al menos client_id en el contrato para no perder el ownership.
      await service
        .from('contracts')
        .update({ client_id: clientId })
        .eq('id', contract_id)
      return NextResponse.json(
        {
          client_id: clientId,
          case_id: null,
          case_number: null,
          warning: 'Cliente registrado pero hubo error al crear el caso',
        },
        { status: 200 },
      )
    }

    // ─────────────────────────────────────────────────────────────────
    // 5. Disparar research de jurisdicción para SIJS (background, no bloquea).
    // ─────────────────────────────────────────────────────────────────
    if (service_slug === 'visa-juvenil') {
      try {
        const result = await triggerJurisdictionResearchAsync(newCase.id, service)
        console.log('[register-client] jurisdiction research trigger:', result)
      } catch (err) {
        console.error('[register-client] trigger error (ignorado):', err)
      }
    }

    return NextResponse.json({
      client_id: clientId,
      case_id: newCase.id,
      case_number: newCase.case_number,
    })
  } catch (err) {
    console.error('[register-client] error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
