'use client'

import { useState } from 'react'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { kanbanColumns, kanbanTransitions, statusLabels } from '@/lib/case-status'
import { CaseCard } from './CaseCard'
import { toast } from 'sonner'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'

interface CaseKanbanProps {
  cases: any[]
}

export function CaseKanban({ cases: initialCases }: CaseKanbanProps) {
  const [cases, setCases] = useState(initialCases)
  const supabase = createClient()

  function getCasesForColumn(columnId: string) {
    return cases.filter((c) => c.intake_status === columnId)
  }

  async function handleDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId) return

    const fromStatus = source.droppableId
    const toStatus = destination.droppableId

    // Validate transition
    const allowed = kanbanTransitions[fromStatus]
    if (!allowed || !allowed.includes(toStatus)) {
      toast.error(`No se puede mover de "${statusLabels[fromStatus]?.label}" a "${statusLabels[toStatus]?.label}"`)
      return
    }

    // Optimistic update
    setCases((prev) =>
      prev.map((c) =>
        c.id === draggableId ? { ...c, intake_status: toStatus } : c
      )
    )

    const { error } = await supabase
      .from('cases')
      .update({ intake_status: toStatus })
      .eq('id', draggableId)

    if (error) {
      // Rollback
      setCases((prev) =>
        prev.map((c) =>
          c.id === draggableId ? { ...c, intake_status: fromStatus } : c
        )
      )
      toast.error('Error al actualizar el estado')
      return
    }

    // Bitácora
    await logActivity({
      caseId: draggableId,
      category: 'case',
      subcategory: SUBCATEGORIES.CASE_STATUS_CHANGED,
      description: `Estado cambiado de ${statusLabels[fromStatus]?.label} a ${statusLabels[toStatus]?.label} (Kanban)`,
      metadata: { from_status: fromStatus, to_status: toStatus, source: 'kanban' },
      visibleToClient: true,
      actor: { kind: 'session', supabase },
      client: supabase,
    })

    toast.success(`Caso movido a "${statusLabels[toStatus]?.label}"`)
  }

  const canDrag = (status: string) => !!kanbanTransitions[status]

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {kanbanColumns.map((column) => {
          const columnCases = getCasesForColumn(column.id)
          return (
            <div key={column.id} className="flex-shrink-0 w-64">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-700">{column.title}</h3>
                <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                  {columnCases.length}
                </span>
              </div>
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[200px] rounded-lg p-2 space-y-2 transition-colors ${
                      snapshot.isDraggingOver
                        ? 'bg-blue-50 border-2 border-dashed border-blue-300'
                        : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {columnCases.map((c, index) => (
                      <Draggable
                        key={c.id}
                        draggableId={c.id}
                        index={index}
                        isDragDisabled={!canDrag(c.intake_status)}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={snapshot.isDragging ? 'opacity-80' : ''}
                          >
                            <CaseCard caseData={c} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {columnCases.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-8">Sin casos</p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}
