'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Loader2 } from 'lucide-react'

interface AvatarUploadProps {
  userId: string
  currentUrl: string | null
  firstName: string
  onUploaded: (url: string) => void
  size?: 'sm' | 'lg'
}

export function AvatarUpload({ userId, currentUrl, firstName, onUploaded, size = 'lg' }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const displayUrl = previewUrl || currentUrl
  const sizeClasses = size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-10 h-10 text-sm'
  const iconSize = size === 'lg' ? 'w-5 h-5' : 'w-3 h-3'

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview
    const reader = new FileReader()
    reader.onload = () => setPreviewUrl(reader.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${userId}/avatar.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(filePath, file, { contentType: file.type, upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(filePath)

      // Add cache-busting param
      const url = `${publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', userId)

      if (updateError) throw updateError

      onUploaded(url)
    } catch (err) {
      console.error('Error uploading avatar:', err)
      setPreviewUrl(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={`${sizeClasses} rounded-full overflow-hidden bg-[#002855] flex items-center justify-center relative group cursor-pointer`}
        disabled={uploading}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[#F2A900] font-bold">{firstName?.charAt(0)?.toUpperCase() || '?'}</span>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading ? (
            <Loader2 className={`${iconSize} text-white animate-spin`} />
          ) : (
            <Camera className={`${iconSize} text-white`} />
          )}
        </div>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
