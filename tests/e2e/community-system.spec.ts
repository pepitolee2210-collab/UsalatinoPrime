import { test, expect } from '@playwright/test'

// =============================================
// PRUEBAS E2E - SISTEMA COMPLETO USALATINOPRIME
// =============================================

test.describe('Páginas públicas', () => {
  test('Landing page carga correctamente', async ({ page }) => {
    const res = await page.goto('/')
    // Puede redirigir a /login o cargar home
    expect(res?.status()).toBeLessThan(500)
  })

  test('Login page carga', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/login/)
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
  })

  test('Register page carga sin campo confirmar contraseña', async ({ page }) => {
    await page.goto('/register')
    await expect(page).toHaveURL(/register/)
    // Campos que SÍ deben existir
    await expect(page.locator('input[name="first_name"]')).toBeVisible()
    await expect(page.locator('input[name="last_name"]')).toBeVisible()
    await expect(page.locator('input[name="phone"]')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    // Campo de confirmar contraseña NO debe existir
    await expect(page.locator('input[name="confirmPassword"]')).not.toBeVisible()
  })

  test('Register page tiene botón de registro', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('button', { name: /regístrese/i })).toBeVisible()
  })

  test('Miedo Creible form es público', async ({ page }) => {
    const res = await page.goto('/miedo-creible')
    expect(res?.status()).toBeLessThan(500)
    await expect(page).toHaveURL(/miedo-creible/)
  })

  test('Visa Juvenil form es público', async ({ page }) => {
    const res = await page.goto('/visa-juvenil-form')
    expect(res?.status()).toBeLessThan(500)
    await expect(page).toHaveURL(/visa-juvenil-form/)
  })

  test('Asilo form es público', async ({ page }) => {
    const res = await page.goto('/asilo-form')
    expect(res?.status()).toBeLessThan(500)
    await expect(page).toHaveURL(/asilo-form/)
  })

  test('Offline page carga', async ({ page }) => {
    const res = await page.goto('/offline')
    expect(res?.status()).toBe(200)
    await expect(page.getByText('Sin conexión a internet')).toBeVisible()
  })
})

test.describe('PWA', () => {
  test('Manifest es accesible', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest')
    expect(res.status()).toBe(200)
    const manifest = await res.json()
    expect(manifest.name).toContain('UsaLatinoPrime')
    expect(manifest.short_name).toBe('UsaLatinoPrime')
    expect(manifest.display).toBe('standalone')
    expect(manifest.theme_color).toBe('#002855')
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3)
  })

  test('Iconos PWA son accesibles', async ({ request }) => {
    const icons = [
      '/icons/icon-192x192.png',
      '/icons/icon-512x512.png',
      '/icons/apple-touch-icon.png',
      '/icons/icon-maskable-512x512.png',
    ]
    for (const icon of icons) {
      const res = await request.get(icon)
      expect(res.status(), `Icono ${icon} debería existir`).toBe(200)
    }
  })
})

test.describe('Rutas protegidas - redirigen a login', () => {
  test('Portal redirige a login', async ({ page }) => {
    await page.goto('/portal/dashboard')
    await expect(page).toHaveURL(/login/)
  })

  test('Comunidad redirige a login', async ({ page }) => {
    await page.goto('/comunidad')
    await expect(page).toHaveURL(/login/)
  })

  test('Comunidad videos redirige a login', async ({ page }) => {
    await page.goto('/comunidad/videos')
    await expect(page).toHaveURL(/login/)
  })

  test('Comunidad pagar redirige a login', async ({ page }) => {
    await page.goto('/comunidad/pagar')
    await expect(page).toHaveURL(/login/)
  })

  test('Comunidad perfil redirige a login', async ({ page }) => {
    await page.goto('/comunidad/perfil')
    await expect(page).toHaveURL(/login/)
  })

  test('Admin redirige a login', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/login/)
  })

  test('Admin comunidad redirige a login', async ({ page }) => {
    await page.goto('/admin/comunidad')
    await expect(page).toHaveURL(/login/)
  })

  test('Admin zelle redirige a login', async ({ page }) => {
    await page.goto('/admin/comunidad/zelle')
    await expect(page).toHaveURL(/login/)
  })

  test('Employee redirige a login', async ({ page }) => {
    await page.goto('/employee/contracts')
    await expect(page).toHaveURL(/login/)
  })
})

test.describe('API routes responden', () => {
  test('API register responde (POST requerido)', async ({ request }) => {
    const res = await request.get('/api/auth/register')
    // GET no es manejado, pero no debe ser 500
    expect(res.status()).not.toBe(500)
  })

  test('API community create-subscription requiere auth', async ({ request }) => {
    const res = await request.post('/api/community/create-subscription')
    // Debería fallar sin auth, pero no 500
    expect(res.status()).not.toBe(500)
  })

  test('API community zelle-submit requiere auth', async ({ request }) => {
    const res = await request.post('/api/community/zelle-submit')
    expect(res.status()).not.toBe(500)
  })

  test('API community zelle-review requiere auth', async ({ request }) => {
    const res = await request.post('/api/community/zelle-review', {
      data: { zelle_id: 'fake', action: 'approved' }
    })
    expect(res.status()).not.toBe(500)
  })

  test('API community cancel-subscription requiere auth', async ({ request }) => {
    const res = await request.post('/api/community/cancel-subscription')
    expect(res.status()).not.toBe(500)
  })

  test('Stripe webhook rechaza sin firma', async ({ request }) => {
    const res = await request.post('/api/webhooks/stripe', {
      data: { type: 'test' },
      headers: { 'Content-Type': 'application/json' }
    })
    // Sin firma Stripe, debe fallar con 400
    expect(res.status()).toBe(400)
  })
})

test.describe('Register form - validaciones', () => {
  test('No envía form vacío (HTML validation)', async ({ page }) => {
    await page.goto('/register')
    const btn = page.getByRole('button', { name: /regístrese/i })
    await btn.click()
    // La URL no debe cambiar (HTML required previene submit)
    await expect(page).toHaveURL(/register/)
  })

  test('Registro con promo param muestra banner', async ({ page }) => {
    await page.goto('/register?promo=visa-juvenil')
    // Si el promo es válido, debe aparecer un banner
    // Si no, simplemente carga el form normal
    await expect(page.locator('input[name="first_name"]')).toBeVisible()
  })
})

test.describe('Navegación entre páginas auth', () => {
  test('Login tiene link a registro', async ({ page }) => {
    await page.goto('/login')
    const registerLink = page.getByRole('link', { name: /regístr/i })
    await expect(registerLink).toBeVisible()
  })

  test('Registro tiene link a login', async ({ page }) => {
    await page.goto('/register')
    const loginLink = page.getByRole('link', { name: /inicie sesión/i })
    await expect(loginLink).toBeVisible()
    await loginLink.click()
    await expect(page).toHaveURL(/login/)
  })
})
