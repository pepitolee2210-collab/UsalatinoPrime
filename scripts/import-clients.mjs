import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hkmeaqehutootharvsbd.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbWVhcWVodXRvb3RoYXJ2c2JkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM1MTkxMiwiZXhwIjoyMDg2OTI3OTEyfQ.oLX4U9-SVVILeWF-qR49h5dWVB-OT3BAcG5y_lfZqWo'

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

// Service mapping from Excel → service_catalog
const SERVICE_MAP = {
  'Visa Juvenil': 'fc0fa8ce-7a02-4608-9071-00a51499a824',
  'I-485': 'e6438257-416d-4f1f-8c5b-aee4356ae712',
  'Ajuste de estatus': 'e6438257-416d-4f1f-8c5b-aee4356ae712',
  'Cambio de corte': '4d13efe8-3bba-412a-9ac8-5b9b364c00ff',
  'Asilo': '0192fe2c-7780-404e-a3bb-014b0e69f2d1',
}

function normalizePhone(raw) {
  return raw.replace(/\D/g, '').replace(/^1(\d{10})$/, '$1')
}

function parseMoney(val) {
  if (!val) return 0
  return parseFloat(String(val).replace(/[$,]/g, '')) || 0
}

function splitName(fullName) {
  // Remove parenthetical nicknames like "(Astrid)"
  const clean = fullName.replace(/\s*\(.*?\)\s*/g, ' ').trim()
  const parts = clean.split(/\s+/)
  if (parts.length <= 2) return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' }
  // For Latin names: first 2 = first name, rest = last name
  // But if 3 words, first = first, rest = last
  if (parts.length === 3) return { first: parts[0], last: parts.slice(1).join(' ') }
  // 4+ words: first 2 = first, rest = last
  return { first: parts.slice(0, 2).join(' '), last: parts.slice(2).join(' ') }
}

// Client data from Excel
const CLIENTS = [
  { name: 'Monica Alejandra Bastidas Solarte', phone: '(620) 794-8793', service: 'Visa Juvenil', total: 2500, abono: 250 },
  { name: 'Mayli Gilvonio Nahui', phone: '(385) 512-5804', service: 'Visa Juvenil', total: 2500, abono: 250 },
  { name: 'Alicia Martinez Quispe', phone: '(972) 585-4270', service: 'Visa Juvenil', total: 2500, abono: 0 },
  { name: 'Betsabet Ruth Arancibia Zorrilla', phone: '(347) 908-9110', service: 'Visa Juvenil', total: 2500, abono: 250 },
  { name: 'Adriana Gisela Caceres', phone: '(347) 776-4162', service: 'Visa Juvenil', total: 2500, abono: 250 },
  { name: 'Monica Lema', phone: '(872) 838-2904', service: 'Visa Juvenil', total: 2500, abono: 250 },
  { name: 'Rudy Sebastian Orozco Gonzalez', phone: '(769) 274-2609', service: 'Visa Juvenil', total: 2500, abono: 250 },
  { name: 'Olga Elizabeth Caina Taipe', phone: '(475) 688-1173', service: 'Visa Juvenil', total: 2500, abono: 250 },
  { name: 'Bessy Carolina Carranza Varela', phone: '(346) 410-1562', service: 'Visa Juvenil', total: 2500, abono: 250 },
  { name: 'Martha Tatiana Flores Crisanto', phone: '(929) 660-7030', service: 'Visa Juvenil', total: 2500, abono: 1000 },
  { name: 'Israel Manriquez Hernandez', phone: '+52 33 2178 1850', service: 'Visa Juvenil', total: 2500, abono: 350 },
  { name: 'Maria Mireya Castro Santos', phone: '+52 33 2178 1850', service: 'Visa Juvenil', total: 2500, abono: 0 },
  { name: 'Jennifer Samanta Velasquez Mejia', phone: '(504) 344-4051', service: 'Visa Juvenil', total: 2500, abono: 500 },
  { name: 'Ana Ruth Gallo', phone: '(980) 526-3563', service: 'I-485', total: 500, abono: 100 },
  { name: 'Mishell Brendaliz Yataco Peralta', phone: '(769) 274-2609', service: 'Visa Juvenil', total: 2500, abono: 250 },
  { name: 'Mishell Brendaliz Yataco Peralta', phone: '(769) 274-2609', service: 'Cambio de corte', total: 250, abono: 250 },
  { name: 'Angel Gabriel Garcia Salas Lemus', phone: '(864) 448-4399', service: 'Visa Juvenil', total: 2500, abono: 250 },
  { name: 'Jose Manuel Pineda Saenz', phone: '+505 8273 5422', service: 'Visa Juvenil', total: 2500, abono: 500 },
  { name: 'Jessica Anahi Ruiz Islas', phone: '(470) 594-9795', service: 'Visa Juvenil', total: 3500, abono: 500 },
  { name: 'Mariela Judith Mendoza Choque', phone: '(908) 584-8001', service: 'Visa Juvenil', total: 2500, abono: 250 },
  { name: 'Wilmer Ivan Gomez Padilla', phone: '(774) 518-7104', service: 'I-485', total: 600, abono: 150 },
  { name: 'Claudia Rodriguez', phone: '(817) 751-3962', service: 'Visa Juvenil', total: 2500, abono: 250 },
  { name: 'Alexandra Campos', phone: '(347) 681-8585', service: 'Ajuste de estatus', total: 500, abono: 100 },
  { name: 'Elbia Licrecia Perez Bamaca', phone: '(609) 801-7641', service: 'I-485', total: 500, abono: 150 },
  { name: 'Claudia Perez Yanez', phone: '(206) 756-6498', service: 'Visa Juvenil', total: 3500, abono: 500 },
  { name: 'Delmis Isabel Mejia Mendoza', phone: '(901) 764-2484', service: 'Visa Juvenil', total: 2500, abono: 150 },
  { name: 'Ruth Milagros Garcia Ubilluz', phone: '+51 941 258 699', service: 'Asilo', total: 2450, abono: 220 },
  { name: 'Bielka Chelenny Santana', phone: '(917) 231-6477', service: 'Visa Juvenil', total: 3500, abono: 0 },
  { name: 'Zayli Gonzalez Ramirez', phone: '(720) 908-1526', service: 'Visa Juvenil', total: 3500, abono: 0 },
  { name: 'Abraham Fabian Toscano Lopez', phone: '(432) 940-6197', service: 'Visa Juvenil', total: 2500, abono: 0 },
  { name: 'Carmen Maricela Cruz Nolasco de Perez', phone: '(561) 788-4565', service: 'Visa Juvenil', total: 3500, abono: 0 },
  { name: 'Lorena Arevalo', phone: '(917) 607-6273', service: 'Visa Juvenil', total: 2500, abono: 0 },
  { name: 'Veronika Pahola Borda Arimborgo', phone: '(973) 847-1140', service: 'Visa Juvenil', total: 2500, abono: 0 },
]

// Deduplicate by phone - same phone = same person, multiple cases
function groupByPhone(clients) {
  const map = new Map()
  for (const c of clients) {
    const norm = normalizePhone(c.phone)
    if (!map.has(norm)) {
      map.set(norm, { ...c, normalizedPhone: norm, cases: [] })
    }
    map.get(norm).cases.push({ service: c.service, total: c.total, abono: c.abono, name: c.name })
  }
  return [...map.values()]
}

async function getExistingPhones() {
  const { data } = await sb.from('profiles').select('id, phone').eq('role', 'client')
  const map = new Map()
  for (const p of (data || [])) {
    if (p.phone) map.set(normalizePhone(p.phone), p.id)
  }
  return map
}

async function createAuthUser(email, firstName, lastName, phone) {
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: 'Temporal2026!',
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName, phone },
  })
  if (error) throw error
  return data.user.id
}

async function createCase(clientId, serviceId, totalCost) {
  const { data, error } = await sb.from('cases').insert({
    client_id: clientId,
    service_id: serviceId,
    intake_status: 'in_progress',
    access_granted: true,
    total_cost: totalCost,
    form_data: {},
    current_step: 0,
  }).select('id, case_number').single()
  if (error) throw error
  return data
}

async function createPayments(clientId, caseId, totalCost, abono) {
  if (abono <= 0) return

  const remaining = totalCost - abono
  const monthlyAmount = 250
  const installmentCount = remaining > 0 ? Math.ceil(remaining / monthlyAmount) : 0
  const totalInstallments = 1 + installmentCount

  const payments = []

  // First payment (abono) - completed
  payments.push({
    case_id: caseId,
    client_id: clientId,
    amount: abono,
    status: 'completed',
    payment_method: 'manual',
    installment_number: 1,
    total_installments: totalInstallments,
    paid_at: new Date().toISOString(),
    due_date: new Date().toISOString().split('T')[0],
  })

  // Remaining installments - pending
  const now = new Date()
  for (let i = 0; i < installmentCount; i++) {
    const dueDate = new Date(now)
    dueDate.setMonth(dueDate.getMonth() + i + 1)
    const isLast = i === installmentCount - 1
    const prevPaid = monthlyAmount * i
    const thisAmount = isLast ? remaining - prevPaid : monthlyAmount

    payments.push({
      case_id: caseId,
      client_id: clientId,
      amount: thisAmount,
      status: 'pending',
      payment_method: 'manual',
      installment_number: i + 2,
      total_installments: totalInstallments,
      due_date: dueDate.toISOString().split('T')[0],
    })
  }

  const { error } = await sb.from('payments').insert(payments)
  if (error) throw error
}

async function main() {
  console.log('=== Import Starting ===')

  const existingPhones = await getExistingPhones()
  console.log(`Existing clients in DB: ${existingPhones.size}`)

  const grouped = groupByPhone(CLIENTS)
  console.log(`Unique clients to process: ${grouped.length}`)

  let created = 0, skipped = 0, casesCreated = 0, errors = 0

  for (const client of grouped) {
    const { first, last } = splitName(client.name)
    const existingId = existingPhones.get(client.normalizedPhone)

    let userId

    if (existingId) {
      console.log(`  EXISTING: ${client.name} (${client.phone}) → ${existingId}`)
      userId = existingId
      skipped++
    } else {
      // Create new user
      const emailSlug = client.normalizedPhone || first.toLowerCase().replace(/\s/g, '')
      const email = `client_${emailSlug}@usalatinoprime.temp`

      try {
        userId = await createAuthUser(email, first, last, client.normalizedPhone)
        console.log(`  CREATED: ${first} ${last} (${client.phone}) → ${userId}`)
        created++
      } catch (err) {
        console.error(`  ERROR creating user ${client.name}: ${err.message}`)
        errors++
        continue
      }
    }

    // Create cases for this client
    for (const c of client.cases) {
      const serviceId = SERVICE_MAP[c.service]
      if (!serviceId) {
        console.error(`  ERROR: Unknown service "${c.service}" for ${client.name}`)
        errors++
        continue
      }

      try {
        const caseData = await createCase(userId, serviceId, c.total)
        console.log(`    CASE: ${c.service} #${caseData.case_number} ($${c.total}, abono $${c.abono})`)
        casesCreated++

        if (c.abono > 0) {
          await createPayments(userId, caseData.id, c.total, c.abono)
          console.log(`    PAYMENTS: $${c.abono} paid + installments created`)
        }
      } catch (err) {
        console.error(`    ERROR creating case for ${client.name}: ${err.message}`)
        errors++
      }
    }
  }

  console.log('\n=== Import Complete ===')
  console.log(`Created: ${created} clients`)
  console.log(`Skipped (existing): ${skipped}`)
  console.log(`Cases created: ${casesCreated}`)
  console.log(`Errors: ${errors}`)
}

main().catch(console.error)
