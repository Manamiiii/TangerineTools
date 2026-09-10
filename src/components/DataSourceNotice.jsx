import { lazy, Suspense, useState } from 'react'
import { Modal } from './common.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'

const SourceDetails = lazy(() => import('./DataSourceContent.jsx').then((module) => ({ default: module.SourceDetails })))

export function DataSourceNotice() {
  const [open, setOpen] = useState(false)
  return <>
    <footer className="data-source-footer">
      <button type="button" className="btn" onClick={() => setOpen(true)}>数据来源与版权</button>
    </footer>
    {open && <Modal title="数据来源与版权" onClose={() => setOpen(false)} width={680}>
      <ErrorBoundary title="来源说明加载失败">
        <Suspense fallback={<p>正在加载来源说明…</p>}><SourceDetails /></Suspense>
      </ErrorBoundary>
    </Modal>}
  </>
}
