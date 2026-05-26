'use client'

import { ContratosView } from '@/app/admin/contratos/contratos-view'
import { LexContractsAgent } from '@/components/lex/lex-contracts-agent'

export function ContratosClient() {
  return (
    <>
      <ContratosView basePath="/employee/contratos" />
      <LexContractsAgent />
    </>
  )
}
