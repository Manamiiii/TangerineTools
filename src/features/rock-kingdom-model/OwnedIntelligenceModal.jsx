import { useEffect, useState } from 'react'
import { Settings2, Sparkles } from 'lucide-react'
import { Modal } from '../../components/common.jsx'
import { db } from '../../db.js'
import {
  buildRockOwnedDiagnostics,
  summarizeRockOwnedDiagnostics,
} from '../../domain/rockKingdomIntelligence.js'
import { ROCK_APPEARANCE_OPTIONS } from '../../domain/rockKingdomScanner.js'
import { ROCK_KINGDOM_PRESET } from '../../presets/rockKingdom.js'
import { ModelSettingsModal } from '../model/ModelSettingsModal.jsx'
import { MODEL_CONFIG_SCOPE, modelConfigIsComplete } from '../model/modelConfig.js'
import { useModelConfig } from '../model/useModelConfig.js'
import { explainRockOwnedDiagnostics } from './rockKingdomModel.js'

const appearanceLabels = new Map(ROCK_APPEARANCE_OPTIONS.map((item) => [item.value, item.label]))

export function OwnedIntelligenceModal({ rows, fields, onClose }) {
  const [state, setState] = useState('loading')
  const [diagnostics, setDiagnostics] = useState([])
  const [error, setError] = useState('')
  const [explanation, setExplanation] = useState(null)
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false)
  const {
    modelConfig,
    loadProvider,
    canCopyOtherConfig,
    loadOtherConfig,
    saveModelConfig,
  } = useModelConfig(MODEL_CONFIG_SCOPE.ROCK_KINGDOM)

  useEffect(() => {
    let active = true
    async function inspect() {
      setState('loading')
      setError('')
      try {
        const [creatureRows, creatureFields, skillRows] = await Promise.all([
          db.catalogRows.where('tableId').equals(ROCK_KINGDOM_PRESET.tables[0].id).toArray(),
          db.catalogFields.where('tableId').equals(ROCK_KINGDOM_PRESET.tables[0].id).sortBy('order'),
          db.catalogRows.where('tableId').equals(ROCK_KINGDOM_PRESET.tables[1].id).toArray(),
        ])
        if (!active) return
        setDiagnostics(buildRockOwnedDiagnostics({
          records: rows,
          ownedFields: fields,
          creatureRows,
          creatureFields,
          skillRows,
        }))
        setState('ready')
      } catch (inspectError) {
        if (!active) return
        setError(inspectError.message || '检查收集记录失败')
        setState('error')
      }
    }
    inspect()
    return () => { active = false }
  }, [fields, rows])

  const summary = summarizeRockOwnedDiagnostics(diagnostics)

  async function explainWithModel() {
    if (!modelConfigIsComplete(modelConfig)) {
      setModelSettingsOpen(true)
      return
    }
    setState('model')
    setError('')
    try {
      setExplanation(await explainRockOwnedDiagnostics({
        config: modelConfig,
        diagnostics,
        summary,
      }))
    } catch (modelError) {
      setError(modelError.message)
    } finally {
      setState('ready')
    }
  }

  return (
    <Modal title={`智能检查所选记录（${rows.length}）`} onClose={onClose} width={860}>
      <div className="owned-intelligence">
        <div className="owned-intelligence-head">
          <div>
            <strong>程序负责计算，模型只负责说明</strong>
            <span>性格分档和银镜目标沿用当前规则；不会修改任何记录。</span>
          </div>
          <button type="button" className="btn btn-icon" title="模型设置" onClick={() => setModelSettingsOpen(true)}>
            <Settings2 size={15} />
          </button>
        </div>
        {state === 'loading' && <p>正在按当前性格规则检查所选记录…</p>}
        {error && <div className="form-error">{error}</div>}
        {state !== 'loading' && diagnostics.length > 0 && (
          <>
            <div className="owned-intelligence-summary">
              <span><strong>{summary.total}</strong> 条</span>
              <span><strong>{summary.issueCount}</strong> 条字段问题</span>
              <span><strong>{summary.recommended}</strong> 条推荐性格</span>
              <span><strong>{summary.keepable}</strong> 条可保留</span>
              <span><strong>{summary.repairable}</strong> 条可改减益</span>
            </div>
            <div className="owned-intelligence-list">
              {diagnostics.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.creatureName}</strong>
                    <span>{item.natureLabel} · {appearanceLabels.get(item.appearance) || item.appearance}</span>
                  </div>
                  <div>
                    {item.decisionLabel && <b className={item.decision}>{item.decisionLabel}</b>}
                    {item.actionLabel && <span>{item.actionLabel}</span>}
                    {item.mirrorTarget && <span>目标：{item.mirrorTarget}</span>}
                  </div>
                  {item.issues.length > 0 && <p>需核对：{item.issues.join('；')}</p>}
                </article>
              ))}
            </div>
            <div className="owned-intelligence-model">
              <button type="button" className="btn btn-primary" disabled={state === 'model'} onClick={explainWithModel}>
                <Sparkles size={14} /> {state === 'model' ? '正在整理…' : 'AI 整理处理优先级'}
              </button>
              <small>最多发送前 50 条的精灵名、性格、外观和程序结论，不发送备注或完整资料库。</small>
            </div>
            {explanation && (
              <section className="owned-intelligence-explanation">
                <strong>AI 说明</strong>
                <p>{explanation.summary}</p>
                {explanation.priorities.length > 0 && (
                  <ol>{explanation.priorities.map((item) => <li key={item}>{item}</li>)}</ol>
                )}
                {explanation.caution && <small>{explanation.caution}</small>}
              </section>
            )}
          </>
        )}
      </div>
      {modelSettingsOpen && (
        <ModelSettingsModal
          config={modelConfig}
          domainLabel="洛克王国"
          copySourceLabel="阅读伴侣"
          canCopySource={canCopyOtherConfig}
          onLoadProvider={loadProvider}
          onLoadCopySource={loadOtherConfig}
          onSave={saveModelConfig}
          onClose={() => setModelSettingsOpen(false)}
        />
      )}
    </Modal>
  )
}
