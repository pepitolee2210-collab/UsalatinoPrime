'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const EMOJIS = ['❤️', '🔥', '👏', '💯', '🙏'] as const

interface ReactionBarProps {
  postId: string
  userId: string
  reactions: { emoji: string; count: number }[]
  userReaction: string | null
}

export function ReactionBar({ postId, userId, reactions: initialReactions, userReaction: initialUserReaction }: ReactionBarProps) {
  const [userReaction, setUserReaction] = useState(initialUserReaction)
  const [reactions, setReactions] = useState(initialReactions)
  const [, startTransition] = useTransition()
  const supabase = createClient()

  async function toggleReaction(emoji: string) {
    const wasSelected = userReaction === emoji

    // Optimistic update
    if (wasSelected) {
      setUserReaction(null)
      setReactions(prev =>
        prev.map(r => r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1) } : r)
      )
    } else {
      // Remove old reaction count
      if (userReaction) {
        setReactions(prev =>
          prev.map(r => r.emoji === userReaction ? { ...r, count: Math.max(0, r.count - 1) } : r)
        )
      }
      setUserReaction(emoji)
      setReactions(prev => {
        const existing = prev.find(r => r.emoji === emoji)
        if (existing) {
          return prev.map(r => r.emoji === emoji ? { ...r, count: r.count + 1 } : r)
        }
        return [...prev, { emoji, count: 1 }]
      })
    }

    startTransition(async () => {
      if (wasSelected) {
        await supabase
          .from('community_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId)
      } else {
        // Upsert: delete old + insert new
        await supabase
          .from('community_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId)

        await supabase
          .from('community_reactions')
          .insert({ post_id: postId, user_id: userId, emoji })
      }
    })
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {EMOJIS.map(emoji => {
        const reaction = reactions.find(r => r.emoji === emoji)
        const count = reaction?.count || 0
        const isSelected = userReaction === emoji

        return (
          <button
            key={emoji}
            onClick={() => toggleReaction(emoji)}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm transition-all',
              isSelected
                ? 'bg-[#F2A900]/15 ring-1 ring-[#F2A900]/40'
                : 'bg-gray-100 hover:bg-gray-200'
            )}
          >
            <span className="text-base">{emoji}</span>
            {count > 0 && (
              <span className={cn('text-xs font-medium', isSelected ? 'text-[#002855]' : 'text-gray-500')}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
