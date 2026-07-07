// 首页场景工作台：场景列表（逐行展示）+ 新建/编辑场景弹窗。

import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { SCENE_TOOLS, SCENE_TYPES } from '../constants.js'
import { createScene, deleteScene, updateScene } from '../db.js'
import { ConfirmDialog, EmptyState, FormRow, IconButton, Modal } from './common.jsx'

function sceneTypeLabel(value) {
  return SCENE_TYPES.find((t) => t.value === value)?.label || value
}

function sceneToolLabels(tools) {
  const labels = (tools || [])
    .map((t) => SCENE_TOOLS.find((s) => s.value === t)?.label)
    .filter(Boolean)
  return labels.length ? labels.join(' · ') : '未启用工具'
}

export function SceneList({ scenes, onOpen }) {
  const [editing, setEditing] = useState(null) // null | 'new' | scene
  const [deleting, setDeleting] = useState(null)

  return (
    <div className="scene-list-page">
      <div className="toolbar toolbar-scenes">
        <h2 className="page-title">场景</h2>
        <IconButton
          icon={Plus}
          label="新建场景"
          variant="primary"
          onClick={() => setEditing('new')}
        />
      </div>

      {scenes.length === 0 ? (
        <EmptyState
          title="还没有场景"
          description="创建一个场景，开始使用资料库等工具。"
          action={
            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              新建场景
            </button>
          }
        />
      ) : (
        <ul className="scene-rows">
          {scenes.map((scene) => (
            <li key={scene.id} className="scene-row" onClick={() => onOpen(scene.id)}>
              <span className="scene-row-name">{scene.name}</span>
              <span className="scene-row-type">{sceneTypeLabel(scene.type)}</span>
              <span className="scene-row-tools">{sceneToolLabels(scene.tools)}</span>
              <span className="scene-row-actions" onClick={(e) => e.stopPropagation()}>
                <IconButton icon={Pencil} title="编辑场景" onClick={() => setEditing(scene)} />
                <IconButton
                  icon={Trash2}
                  title="删除场景"
                  variant="danger"
                  onClick={() => setDeleting(scene)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <SceneFormModal
          scene={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="删除场景"
          message={`确定删除场景「${deleting.name}」吗？该场景下的全部资料表、字段与行数据都会被一并删除，此操作不可撤销。`}
          confirmText="删除"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteScene(deleting.id)
            setDeleting(null)
          }}
        />
      ) : null}
    </div>
  )
}

function SceneFormModal({ scene, onClose }) {
  const [name, setName] = useState(scene?.name || '')
  const [type, setType] = useState(scene?.type || SCENE_TYPES[0].value)
  const [tools, setTools] = useState(scene?.tools || ['catalog'])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function toggleTool(value) {
    setTools((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('请输入场景名称')
      return
    }
    setSaving(true)
    if (scene) {
      await updateScene(scene.id, { name: name.trim(), type, tools })
    } else {
      await createScene({ name: name.trim(), type, tools })
    }
    setSaving(false)
    onClose()
  }

  return (
    <Modal
      title={scene ? '编辑场景' : '新建场景'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" form="scene-form" className="btn btn-primary" disabled={saving}>
            保存
          </button>
        </>
      }
    >
      <form id="scene-form" onSubmit={handleSubmit} className="stack-form">
        <FormRow label="名称">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：洛克王国"
            autoFocus
          />
        </FormRow>
        <FormRow label="类型" hint={SCENE_TYPES.find((t) => t.value === type)?.description}>
          <div className="segmented segmented-wrap">
            {SCENE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`segmented-item ${type === t.value ? 'active' : ''}`}
                title={t.description}
                onClick={() => setType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </FormRow>
        <FormRow label="启用工具">
          <div className="tool-checkboxes">
            {SCENE_TOOLS.map((tool) => (
              <label key={tool.value} className={`tool-checkbox ${tool.ready ? '' : 'disabled'}`}>
                <input
                  type="checkbox"
                  checked={tools.includes(tool.value)}
                  disabled={!tool.ready}
                  onChange={() => toggleTool(tool.value)}
                />
                {tool.label}
                {!tool.ready && <span className="tool-badge-soon">即将推出</span>}
              </label>
            ))}
          </div>
        </FormRow>
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  )
}
