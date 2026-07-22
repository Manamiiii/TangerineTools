// 应用入口组件：基于 hash 的极简路由（首页场景列表 ↔ 场景工作台）、
// 启动时的预置资料播种、全局 JSON 导出/导入（仅首页展示）。

import { lazy, Suspense, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Download, Upload } from 'lucide-react'
import { db, ensureSeeded, exportAllData, importAllData } from './db.js'
import { SCENE_TOOLS } from './constants.js'
import { SceneList } from './components/scenes.jsx'
import { ConfirmDialog, IconButton } from './components/common.jsx'
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
  const activeScene = (sceneId && scenes?.find((s) => s.id === sceneId)) || null

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
          <SceneList scenes={scenes} onOpen={goToScene} />
        )}
      </main>
    </div>
  )
}

function SceneWorkbench({ scene }) {
  const readyTools = SCENE_TOOLS.filter(
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
  const [pendingFile, setPendingFile] = useState(null)
  const [error, setError] = useState('')

  async function handleExport() {
    const payload = await exportAllData()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tangerine-tools-${payload.exportedAt.slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChosen(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setPendingFile(file)
  }

  async function confirmImport() {
    try {
      const text = await pendingFile.text()
      const payload = JSON.parse(text)
      await importAllData(payload)
      setPendingFile(null)
    } catch (err) {
      setPendingFile(null)
      setError(err.message || '导入失败，请检查文件内容')
    }
  }

  return (
    <div className="global-data-actions">
      {error && <span className="form-error">{error}</span>}
      <button type="button" className="btn global-data-btn" onClick={handleExport}>
        <Download size={14} />
        导出数据
      </button>
      <label className="btn btn-file global-data-btn">
        <Upload size={14} />
        导入数据
        <input type="file" accept="application/json" hidden onChange={handleFileChosen} />
      </label>
      {pendingFile && (
        <ConfirmDialog
          title="导入数据"
          message={`即将导入「${pendingFile.name}」。相同 id 的数据会被覆盖，文件中未包含的数据将保留在本地，此操作不可撤销。确定继续吗？`}
          confirmText="导入"
          onCancel={() => setPendingFile(null)}
          onConfirm={confirmImport}
        />
      )}
    </div>
  )
}
