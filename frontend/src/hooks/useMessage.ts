import { useCallback, useEffect, useRef, useState } from 'react'

export function useMessage(delay = 3500) {
  const [message, setMessage] = useState('')
  const [type, setType] = useState<'ok' | 'err'>('ok')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    if (timer.current) clearTimeout(timer.current)
    setMessage(msg)
    setType(kind)
    timer.current = setTimeout(() => setMessage(''), delay)
  }, [delay])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const ok = useCallback((msg: string) => show(msg, 'ok'), [show])
  const err = useCallback((msg: string) => show(msg, 'err'), [show])

  return { message, type, ok, err }
}
