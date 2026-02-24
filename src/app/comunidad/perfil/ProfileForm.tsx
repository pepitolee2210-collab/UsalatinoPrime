'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AvatarUpload } from '@/components/community/AvatarUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LogOut, Save, Loader2 } from 'lucide-react'

interface ProfileFormProps {
  userId: string
  initialData: {
    firstName: string
    lastName: string
    phone: string
    email: string
    avatarUrl: string | null
  }
}

export function ProfileForm({ userId, initialData }: ProfileFormProps) {
  const [firstName, setFirstName] = useState(initialData.firstName)
  const [lastName, setLastName] = useState(initialData.lastName)
  const [phone, setPhone] = useState(initialData.phone)
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatarUrl)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone,
      })
      .eq('id', userId)

    setSaving(false)
    if (!error) {
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <AvatarUpload
          userId={userId}
          currentUrl={avatarUrl}
          firstName={firstName}
          onUploaded={setAvatarUrl}
          size="lg"
        />
        <p className="text-sm text-gray-500">Toca para cambiar tu foto</p>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="firstName">Nombre</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="lastName">Apellido</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={initialData.email}
            disabled
            className="bg-gray-50"
          />
          <p className="text-xs text-gray-400 mt-1">El email no se puede cambiar</p>
        </div>
      </div>

      {/* Save */}
      <Button type="submit" className="w-full bg-[#002855] hover:bg-[#002855]/90" disabled={saving}>
        {saving ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        {saved ? '¡Guardado!' : 'Guardar cambios'}
      </Button>

      {/* Logout */}
      <Button
        type="button"
        variant="outline"
        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={handleLogout}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Cerrar Sesión
      </Button>
    </form>
  )
}
