import { useEffect, useRef, useState } from 'react'

// 同一操作在当前请求完成前只执行一次；失败后释放锁，允许原地重试。
export function createAsyncAction(onChange) {
  let pending = false
  return {
    get pending() { return pending },
    async run(action) {
      if (pending) return false
      pending = true
      onChange({ pending: true, error: '' })
      let error = ''
      try {
        await action()
        return true
      } catch (cause) {
        error = cause?.message || '操作失败，请重试'
        return false
      } finally {
        pending = false
        onChange({ pending: false, error })
      }
    },
  }
}

export function useAsyncAction() {
  const [state, setState] = useState({ pending: false, error: '' })
  const mounted = useRef(true)
  const action = useRef(null)
  if (!action.current) {
    action.current = createAsyncAction((next) => { if (mounted.current) setState(next) })
  }
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  return { ...state, run: action.current.run }
}
