'use client'

import { Card, CardBody } from '@heroui/react'
import { Rocket } from 'lucide-react'

export function ComingSoon() {
  return (
    <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
      <CardBody className="py-16">
        <div className="flex flex-col items-center justify-center text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 dark:bg-primary/10 rounded-full blur-2xl" />
            <div className="relative bg-primary/10 dark:bg-primary/20 rounded-full p-6">
              <Rocket size={48} className="text-primary" strokeWidth={1.5} />
            </div>
          </div>
          
          <div className="space-y-2 max-w-md">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Coming Soon
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              This feature is currently under development and will be available soon.
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

