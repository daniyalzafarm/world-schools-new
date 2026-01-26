'use client'

import { useState } from 'react'
import { Button } from '@heroui/react'
import { Input } from '@world-schools/ui-web'

interface CustomActivityInputProps {
  placeholder: string
  onAdd: (value: string) => void
  buttonText?: string
}

export function CustomActivityInput({
  placeholder,
  onAdd,
  buttonText = 'Add',
}: CustomActivityInputProps) {
  const [value, setValue] = useState('')

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(value.trim())
      setValue('')
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onValueChange={setValue}
        placeholder={placeholder}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        className="flex-1"
      />
      <Button onPress={handleAdd} color="primary">
        {buttonText}
      </Button>
    </div>
  )
}
