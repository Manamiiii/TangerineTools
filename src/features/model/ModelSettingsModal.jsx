import { useEffect, useState } from 'react'
import { ExternalLink, Sparkles } from 'lucide-react'
import {
  READING_MODEL_PROVIDER,
  READING_MODEL_PROVIDERS,
} from './modelProviders.js'
import { Modal } from '../../components/common.jsx'
import { normalizeModelEndpoint } from './modelClient.js'

export function ModelSettingsModal({
  config,
  domainLabel,
  onLoadProvider,
  onSave,
  onClose,
}) {
  const [draft, setDraft] = useState(config)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => setDraft(config), [config])

  const provider = READING_MODEL_PROVIDERS[draft.providerId]
    || READING_MODEL_PROVIDERS[READING_MODEL_PROVIDER.CUSTOM]

  function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      const endpoint = normalizeModelEndpoint(draft.endpoint)
      if (!draft.model.trim()) throw new Error('请填写模型 ID')
      onSave({ ...draft, endpoint })
      setMessage(draft.apiKey.trim()
        ? `已保存 ${provider.label} 配置。`
        : '接口地址和模型已保存，API Key 已清除。')
    } catch (cause) {
      setError(cause?.message || '配置保存失败，请检查浏览器存储权限后重试')
    }
  }

  return (
    <Modal title={`${domainLabel}模型服务`} onClose={onClose} size="md">
      <form className="shared-model-settings" onSubmit={submit}>
        <p>
          模型功能可选，不配置也能使用资料、收藏、性格与孵蛋规则，以及本地 OCR。这组配置只供{domainLabel}使用。
          只有点击模型功能时才会发送当前所需的少量内容。
        </p>
        <label>
          <span>模型供应商</span>
          <select
            className="select"
            value={draft.providerId}
            onChange={(event) => {
              setDraft(onLoadProvider(event.target.value))
              setMessage('')
              setError('')
            }}
          >
            {Object.values(READING_MODEL_PROVIDERS).map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <small>{provider.description}</small>
        </label>
        <label>
          <span>Chat Completions 兼容地址</span>
          <input
            className="input"
            value={draft.endpoint}
            onChange={(event) => setDraft((current) => ({ ...current, endpoint: event.target.value }))}
          />
        </label>
        <label>
          <span>模型 ID</span>
          <input
            className="input"
            list="shared-model-options"
            value={draft.model}
            onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))}
            placeholder="按服务商文档填写"
          />
          <datalist id="shared-model-options">
            {provider.models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </datalist>
        </label>
        <label>
          <span>API Key</span>
          <input
            className="input"
            type="password"
            value={draft.apiKey}
            onChange={(event) => setDraft((current) => ({ ...current, apiKey: event.target.value }))}
            placeholder="只保存在当前浏览器会话"
            autoComplete="off"
          />
        </label>
        {(provider.consoleUrl || provider.docsUrl) && (
          <div className="shared-model-links">
            {provider.consoleUrl && <a href={provider.consoleUrl} target="_blank" rel="noreferrer">服务商控制台 <ExternalLink size={12} /></a>}
            {provider.docsUrl && <a href={provider.docsUrl} target="_blank" rel="noreferrer">官方文档 <ExternalLink size={12} /></a>}
          </div>
        )}
        <small>接口和模型保存在 localStorage；API Key 保存在 sessionStorage。共享设备用完后请清空 Key 并保存；浏览器恢复会话时可能恢复会话数据。</small>
        <small>浏览器会直接连接所选供应商并发送 API Key。只填写可信接口；供应商须允许浏览器跨域访问（CORS），可能产生供应商费用。</small>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="shared-model-message" role="status">{message}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => {
            setDraft((current) => ({ ...current, apiKey: '' }))
            setError('')
            setMessage('Key 输入已清空，点击「保存配置」后生效。')
          }}>清空 Key 输入</button>
          <button type="submit" className="btn btn-primary"><Sparkles size={14} /> 保存配置</button>
        </div>
      </form>
    </Modal>
  )
}
