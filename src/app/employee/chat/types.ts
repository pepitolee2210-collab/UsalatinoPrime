export interface StaffProfile {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: 'admin' | 'employee' | 'client'
  employee_type: 'paralegal' | 'senior_consultant' | 'contracts_manager' | null
}

export interface ConversationListItem {
  id: string
  type: 'dm' | 'group'
  name: string | null
  last_message_at: string
  participants: StaffProfile[]
  last_message: {
    id: string
    body: string | null
    attachment_type: 'image' | 'document' | null
    attachment_name: string | null
    created_at: string
    sender_id: string
  } | null
  unread_count: number
}

export interface ChatMention {
  type: 'client' | 'case'
  id: string
  label: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  body: string | null
  attachment_url: string | null
  attachment_type: 'image' | 'document' | null
  attachment_name: string | null
  attachment_size: number | null
  mentions: ChatMention[]
  created_at: string
}
