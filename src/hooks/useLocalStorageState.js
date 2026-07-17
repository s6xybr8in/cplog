import { useState, useEffect, useRef } from 'react'

function useLocalStorageState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initialValue
    } catch {
      return initialValue
    }
  })

  const timerRef = useRef(null)
  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state))
      } catch {
        // localStorage unavailable (e.g. private mode quota) — fail silently
      }
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [key, state])

  return [state, setState]
}

export { useLocalStorageState }
