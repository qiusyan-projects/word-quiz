import * as React from 'react'

import { cn } from '@/lib/utils'

const ToastContext = React.createContext<(msg: string) => void>(() => {})

export function useToast() {
  return React.useContext(ToastContext)
}

/** 轻量 toast：一次只显示一条，自动消失。role=status 供读屏播报 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = React.useState('')
  const [show, setShow] = React.useState(false)
  const timer = React.useRef<number | undefined>(undefined)

  const push = React.useCallback((m: string) => {
    setMsg(m)
    setShow(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShow(false), 2600)
  }, [])

  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4 transition-all duration-200',
          show ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        )}
      >
        {msg && (
          <div className="max-w-[92vw] rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-xl">
            {msg}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
