'use client'

import { useState } from 'react'
import { Button, Input, Textarea } from '@heroui/react'
import { Trash2 } from 'lucide-react'

export interface TimeSlot {
  id: string
  time: string
  activity: string
  description?: string
}

export interface Schedule {
  id: string
  type: 'daily' | 'weekly'
  ageGroup?: string
  day?: string
  timeSlots: TimeSlot[]
}

export interface TimeSlotError {
  time?: string
  activity?: string
}

interface TimelineBuilderProps {
  timeSlots: TimeSlot[]
  onChange: (timeSlots: TimeSlot[]) => void
  errors?: Record<string, TimeSlotError> // Map of slot ID to errors
}

export function TimelineBuilder({ timeSlots, onChange, errors = {} }: TimelineBuilderProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const addTimeSlot = () => {
    const newSlot: TimeSlot = {
      id: `slot-${Date.now()}`,
      time: '',
      activity: '',
      description: '',
    }

    onChange([...timeSlots, newSlot])
  }

  const updateTimeSlot = (index: number, updates: Partial<TimeSlot>) => {
    const updated = timeSlots.map((slot, i) => (i === index ? { ...slot, ...updates } : slot))

    onChange(updated)
  }

  const deleteTimeSlot = (index: number) => {
    onChange(timeSlots.filter((_, i) => i !== index))
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()

    if (draggedIndex === null || draggedIndex === index) return

    const items = [...timeSlots]
    const draggedItem = items[draggedIndex]
    items.splice(draggedIndex, 1)
    items.splice(index, 0, draggedItem)

    onChange(items)

    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  return (
    <div className="space-y-4">
      {/* Time Slots */}
      <div className="space-y-3">
        {timeSlots.map((slot, index) => (
          <div
            key={slot.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={e => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`
              flex gap-3 rounded-lg border-2 border-default-200 bg-white p-3 transition-all dark:bg-default-50
              ${draggedIndex === index ? 'opacity-50' : ''}
            `}
          >
            {/* Drag Handle */}
            <div className="flex cursor-grab items-start pt-2 text-default-400 active:cursor-grabbing">
              ⋮⋮
            </div>

            {/* Timeline Dot */}
            <div className="relative flex flex-col items-center">
              <div className="h-3 w-3 rounded-full border-2 border-primary bg-white" />
              {index < timeSlots.length - 1 && <div className="h-full w-0.5 bg-default-200" />}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="w-32">
                  <Input
                    type="time"
                    value={slot.time}
                    onValueChange={value => updateTimeSlot(index, { time: value })}
                    size="sm"
                    isInvalid={!!errors[slot.id]?.time}
                    errorMessage={errors[slot.id]?.time}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={slot.activity}
                    onValueChange={value => updateTimeSlot(index, { activity: value })}
                    placeholder="Activity name (e.g., Breakfast, Morning Activities)"
                    size="sm"
                    isInvalid={!!errors[slot.id]?.activity}
                    errorMessage={errors[slot.id]?.activity}
                  />
                </div>
              </div>

              <Textarea
                value={slot.description || ''}
                onValueChange={value => updateTimeSlot(index, { description: value })}
                placeholder="Optional description..."
                minRows={1}
                className="text-sm"
              />
            </div>

            {/* Delete Button */}
            <Button
              onPress={() => deleteTimeSlot(index)}
              isIconOnly
              title="Delete time slot"
              color="danger"
              size="sm"
              variant="flat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add Time Slot Button */}
      <Button onPress={addTimeSlot} variant="bordered" className="w-full">
        + Add Time Slot
      </Button>
    </div>
  )
}
