'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-[color:var(--admin-accent-soft)] border border-[color:var(--admin-border)]">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[color:var(--admin-fg-muted)] mb-0.5">Link Universal de Citas</p>
        <p className="text-sm font-mono text-[color:var(--admin-accent)] truncate">{link}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className={`shrink-0 ${copied ? 'bg-green-50 border-green-200 text-green-700' : ''}`}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 mr-1" />
            Copiado
          </>
        ) : (
          <>
            <Copy className="w-4 h-4 mr-1" />
            Copiar Link
          </>
        )}
      </Button>
    </div>
  )
}
