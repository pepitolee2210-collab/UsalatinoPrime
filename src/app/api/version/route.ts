import { NextResponse } from 'next/server'

// Devuelve el commit SHA del deploy actual (Vercel lo inyecta en
// VERCEL_GIT_COMMIT_SHA). Permite confirmar de forma determinista QUÉ código
// está activo antes de disparar una prueba — sin esto, no se puede saber si un
// deploy ya reemplazó al anterior.
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
  })
}
