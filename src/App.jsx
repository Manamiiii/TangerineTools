// 应用入口组件：基于 hash 的极简路由（首页场景列表 ↔ 场景工作台）、
// 启动时的预置资料播种、全局 JSON 导出/导入（仅首页展示）。

import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Download, Upload } from 'lucide-react'
import {
  db,
  ensureSeeded,
  exportAllData,
  exportReadingCompanionData,
  importAllData,
  previewImportData,
} from './db.js'
import { sceneToolsFor } from './constants.js'
import { SceneList } from './components/scenes.jsx'
import { IconButton, Modal } from './components/common.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

const lazyTool = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })))
const CatalogTool = lazyTool(() => import('./components/dataTables.jsx'), 'CatalogTool')
const NatureTool = lazyTool(() => import('./components/nature.jsx'), 'NatureTool')
const StockTool = lazyTool(() => import('./components/stock.jsx'), 'StockTool')
const OwnedTool = lazyTool(() => import('./components/owned.jsx'), 'OwnedTool')
const BreedingTool = lazyTool(() => import('./components/breeding.jsx'), 'BreedingTool')

// 工具 value -> 对应的工具组件。只有 constants.js 中标记 ready:true 的工具
// 才会被场景工作台实际渲染、并出现在多工具切换器中。
const TOOL_COMPONENTS = {
  catalog: CatalogTool,
  owned: OwnedTool,
  nature: NatureTool,
  stock: StockTool,
  breeding: BreedingTool,
}

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1))
  useEffect(() => {
    function onHashChange() {
      setHash(window.location.hash.slice(1))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  return hash
}

function goHome() {
  window.location.hash = ''
}

function goToScene(id) {
  window.location.hash = `scene/${id}`
}

export default function App() {
  const [seeded, setSeeded] = useState(false)
  const [bootError, setBootError] = useState('')
  const [bootAttempt, setBootAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setSeeded(false)
    setBootError('')
    ensureSeeded()
      .then(() => { if (active) setSeeded(true) })
      .catch((error) => { if (active) setBootError(error?.message || '本地数据初始化失败') })
    return () => { active = false }
  }, [bootAttempt])

  const hash = useHashRoute()
  const sceneId = hash.startsWith('scene/') ? hash.slice('scene/'.length) : null
  const scenes = useLiveQuery(() => db.scenes.orderBy('order').toArray(), [])
  const visibleScenes = scenes?.filter((scene) => (
    scene.type !== 'reading' && !scene.tools?.includes('reader')
  ))
  const activeScene = (sceneId && visibleScenes?.find((s) => s.id === sceneId)) || null

  if (bootError) {
    return (
      <div className="app-loading app-boot-error" role="alert">
        <strong>应用启动失败</strong>
        <span>{bootError}</span>
        <button type="button" className="btn btn-primary" onClick={() => setBootAttempt((value) => value + 1)}>
          重新尝试
        </button>
      </div>
    )
  }

  if (!seeded || !scenes) {
    return <div className="app-loading">加载中…</div>
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button type="button" className="app-brand" onClick={goHome}>
          TangerineTools
        </button>
        {activeScene ? (
          <div className="scene-context">
            <IconButton icon={ArrowLeft} title="返回场景列表" onClick={goHome} />
            <span className="scene-context-name">{activeScene.name}</span>
          </div>
        ) : (
          <GlobalDataActions />
        )}
      </header>
      <main className="app-main">
        {activeScene ? (
          <SceneWorkbench scene={activeScene} />
        ) : (
          <SceneList scenes={visibleScenes} onOpen={goToScene} />
        )}
      </main>
    </div>
  )
}

function SceneWorkbench({ scene }) {
  const readyTools = sceneToolsFor(scene).filter(
    (tool) => tool.ready && scene.tools?.includes(tool.value),
  )
  const [activeTool, setActiveTool] = useState(null)
  const current = readyTools.find((t) => t.value === activeTool) || readyTools[0] || null

  if (!current) {
    return (
      <div className="scene-workbench-empty">
        <p>该场景尚未启用任何已实现的工具，请先在场景编辑中开启已实现的工具。</p>
      </div>
    )
  }

  const ToolComponent = TOOL_COMPONENTS[current.value]

  return (
    <div className="scene-workbench">
      {readyTools.length > 1 && (
        <div className="segmented tool-switcher">
          {readyTools.map((tool) => (
            <button
              key={tool.value}
              type="button"
              className={`segmented-item ${current.value === tool.value ? 'active' : ''}`}
              onClick={() => setActiveTool(tool.value)}
            >
              {tool.label}
            </button>
          ))}
        </div>
      )}
      <ErrorBoundary key={current.value} title={`${current.label}加载失败`}>
        <Suspense fallback={<div className="empty-state">正在加载工具…</div>}>
          <ToolComponent scene={scene} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

function GlobalDataActions() {
  const [pendingImport, setPendingImport] = useState(null)
  const [busy, setBusy] = useState('')
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const readingRecordCount = useLiveQuery(() => db.meta.filter((record) => (
    typeof record?.key === 'string'
    && (record.key.startsWith('readerState:') || record.key.startsWith('readerPersonalPackage:'))
  )).count(), [])

  async function runAction(label, action) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(label)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (err) {
      setError(err.message || '操作失败，请重试')
    } finally {
      busyRef.current = false
      setBusy('')
    }
  }

  function downloadPayload(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExport() {
    return runAction('正在导出…', async () => {
      const payload = await exportAllData()
      downloadPayload(payload, `tangerine-tools-${payload.exportedAt.slice(0, 10)}.json`)
    })
  }

  function handleReadingMigrationExport() {
    return runAction('正在导出…', async () => {
      const payload = await exportReadingCompanionData()
      downloadPayload(payload, `tangerine-reading-companion-${payload.exportedAt.slice(0, 10)}.json`)
    })
  }

  function handleFileChosen(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    return runAction('正在检查备份…', async () => {
      const payload = JSON.parse(await file.text())
      const summary = await previewImportData(payload)
      setPendingImport({ name: file.name, payload, summary })
    })
  }

  function confirmImport() {
    return runAction('正在导入…', async () => {
      await importAllData(pendingImport.payload)
      setPendingImport(null)
      setNotice('导入完成。重新加载页面后会检查正式资料。')
    })
  }

  function closeImport() {
    if (busyRef.current) return
    setPendingImport(null)
    setError('')
  }

  const disabled = Boolean(busy || pendingImport)
  return (
    <div className="global-data-actions">
      {error && !pendingImport && <span className="form-error" role="alert">{error}</span>}
      {busy && !pendingImport && <span role="status">{busy}</span>}
      {notice && <span role="status">{notice}</span>}
      <button type="button" className="btn global-data-btn" disabled={disabled} onClick={handleExport}>
        <Download size={14} /> 导出数据
      </button>
      {readingRecordCount > 0 && (
        <button
          type="button"
          className="btn global-data-btn"
          disabled={disabled}
          onClick={handleReadingMigrationExport}
          title="导出旧阅读进度和个人书籍，供 Tangerine Reading Companion 导入"
        >
          <Download size={14} /> 迁移阅读数据
        </button>
      )}
      <label className="btn btn-file global-data-btn" aria-disabled={disabled}>
        <Upload size={14} /> 导入数据
        <input type="file" accept="application/json" hidden disabled={disabled} onChange={handleFileChosen} />
      </label>
      {pendingImport && (
        <Modal
          title="确认导入备份"
          onClose={closeImport}
          footer={<>
            <button type="button" className="btn" disabled={Boolean(busy)} onClick={closeImport}>取消</button>
            <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={confirmImport}>
              {busy || '按 id 合并导入'}
            </button>
          </>}
        >
          <div className="import-preview" aria-busy={Boolean(busy)}>
            <p>文件：{pendingImport.name}</p>
            <p>同 id 的记录整条覆盖，文件未包含的本地记录保留。请确认已保存需要保留的本地备份。</p>
            <table>
              <caption>按当前本地数据估算的导入范围</caption>
              <thead><tr><th>数据</th><th>新增</th><th>覆盖</th></tr></thead>
              <tbody>{pendingImport.summary.collections.map((item) => (
                <tr key={item.key}><td>{item.label}</td><td>{item.added}</td><td>{item.overwritten}</td></tr>
              ))}</tbody>
            </table>
            {pendingImport.summary.warningCount > 0 && (
              <div role="status">
                <p>发现 {pendingImport.summary.warningCount} 项关联警告。导入会保留这些记录，不会自动删除或修复引用。</p>
                <details>
                  <summary>查看关联警告{pendingImport.summary.warningCount > 20 ? '（前 20 项）' : ''}</summary>
                  <ul>{pendingImport.summary.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
                </details>
              </div>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  )
}
