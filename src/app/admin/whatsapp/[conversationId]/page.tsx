import { WhatsappDetailView } from '../whatsapp-detail-view'

export const dynamic = 'force-dynamic'

export default async function WhatsappConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  return <WhatsappDetailView conversationId={conversationId} basePath="/admin/whatsapp" />
}
