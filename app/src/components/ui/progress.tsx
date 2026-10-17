import * as React from 'react'

import { cn } from '@/lib/utils'

/** 极简进度条：黑白体系里用纯前景区分，不引入彩色 */
export function Progress({
  value = 0,
  className,
  barClassName,
  ...props
}: React.ComponentProps<'div'> & { value?: number; barClassName?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-secondary', className)}
      {...props}
    >
      <div
        className={cn('h-full rounded-full bg-primary transition-[width] duration-300 ease-out', barClassName)}
        style={{ width: v + '%' }}
      />
    </div>
  )
}

export function Separator({ className, ...props }: React.ComponentProps<'div'>) {
  return <div role="separator" className={cn('h-px w-full bg-border', className)} {...props} />
}
