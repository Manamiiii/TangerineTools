import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ensureOwnedTable } from '../db.js'

export function useOwnedTable(sceneId) {
  const [attempt, setAttempt] = useState(0)
  const [initialization, setInitialization] = useState(null)
  useEffect(() => {
    let active = true
    setInitialization(null)
    ensureOwnedTable(sceneId).then(
      () => { if (active) setInitialization({ sceneId, ready: true, error: '' }) },
      (error) => {
        if (active) setInitialization({ sceneId, ready: false, error: error?.message || '收集记录初始化失败' })
      },
    )
    return () => { active = false }
  }, [sceneId, attempt])
  const table = useLiveQuery(() => db.catalogTables.where('sceneId').equals(sceneId)
    .filter((item) => item.kind === 'owned').first(), [sceneId])
  const current = initialization?.sceneId === sceneId ? initialization : null
  return {
    table: current?.ready ? table : undefined,
    error: current?.error || '',
    retry: () => { setInitialization(null); setAttempt((value) => value + 1) },
  }
}
