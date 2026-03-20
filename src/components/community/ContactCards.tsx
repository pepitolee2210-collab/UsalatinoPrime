'use client'

import { Phone, Scale, Monitor } from 'lucide-react'

const contacts = [
  {
    name: 'Diana',
    role: 'Asesora Legal',
    phone: '573150486059',
    phoneDisplay: '+57 315 048 6059',
    description: 'Consultas legales, preguntas sobre su caso, documentos y trámites migratorios.',
    icon: Scale,
    gradient: 'from-[#002855] to-[#001d3d]',
    accent: '#F2A900',
  },
  {
    name: 'Giuseppe',
    role: 'Asesor Tecnológico',
    phone: '51908765016',
    phoneDisplay: '+51 908 765 016',
    description: 'Problemas con la plataforma, errores técnicos o preguntas sobre el sistema.',
    icon: Monitor,
    gradient: 'from-[#1a1a2e] to-[#16213e]',
    accent: '#00d4ff',
  },
]

export function ContactCards() {
  return (
    <div className="rounded-3xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
      {/* Header */}
      <div
        className="px-6 py-4"
        style={{ background: 'linear-gradient(135deg, #001020 0%, #002855 100%)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(242,169,0,0.18)' }}>
            <Phone className="w-4.5 h-4.5 text-[#F2A900]" />
          </div>
          <div>
            <p className="font-bold text-white text-[15px]">Línea de Contacto</p>
            <p className="text-[11px] text-white/40">Estamos aquí para ayudarte</p>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="bg-white divide-y divide-gray-100">
        {contacts.map(contact => {
          const Icon = contact.icon
          const whatsappUrl = `https://wa.me/${contact.phone}`

          return (
            <div key={contact.name} className="px-5 py-4">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${contact.gradient.includes('002855') ? '#002855' : '#1a1a2e'}, ${contact.gradient.includes('001d3d') ? '#001d3d' : '#16213e'})` }}
                >
                  <Icon className="w-5 h-5" style={{ color: contact.accent }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-gray-900 text-sm">{contact.name}</span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${contact.accent}20`, color: contact.accent === '#F2A900' ? '#9a6500' : '#0099cc' }}
                    >
                      {contact.role}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-2.5">{contact.description}</p>

                  {/* WhatsApp button */}
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-[0.97]"
                    style={{
                      background: '#25D366',
                      color: '#fff',
                      boxShadow: '0 2px 8px rgba(37,211,102,0.3)',
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Escribir por WhatsApp
                  </a>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
