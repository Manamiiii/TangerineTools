// 首页场景工作台：场景列表（逐行展示）+ 新建/编辑场景弹窗。

import { useState } from 'react'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { SCENE_TOOLS, SCENE_TYPES, sceneToolsFor } from '../constants.js'
import { createScene, deleteScene, updateScene } from '../db.js'
import { ConfirmDialog, EmptyState, FormRow, IconButton, Modal } from './common.jsx'

function sceneTypeLabel(value) {
  return SCENE_TYPES.find((t) => t.value === value)?.label || '游戏'
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
      <section className="getting-started" aria-labelledby="getting-started-title">
        <h1 id="getting-started-title">整理游戏收藏，决定下一只怎么培养</h1>
        <p>洛克王国世界玩家可以直接查资料、记精灵，再按自己的收藏查看性格和孵蛋建议。其他游戏可以新建场景，自行配置资料表。</p>
        <ol>
          <li><strong>查资料</strong>：打开下方「洛克王国」，搜索精灵或切换到技能资料。</li>
          <li><strong>记一只</strong>：进入「收集记录」→「新增记录」，选择图鉴名，再填写性格和外观。</li>
          <li><strong>看建议</strong>：查看「性格推荐」；录入稀有亲本后再尝试「孵蛋推荐」。建议供取舍，不是必须集齐的清单。</li>
        </ol>
        <p className="local-data-note"><strong>请定期导出备份。</strong>收藏只保存在当前浏览器、当前网址中，不会自动同步到 GitHub 或其他设备。更换浏览器、网址或清除站点数据前，先用上方「导出数据」保存 JSON；恢复时使用「导入数据」。</p>
      </section>
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
            <li key={scene.id} className="scene-row">
              <button type="button" className="scene-row-name scene-open-button" onClick={() => onOpen(scene.id)}>{scene.name}</button>
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
  const [type, setType] = useState(
    SCENE_TYPES.some((item) => item.value === scene?.type) ? scene.type : SCENE_TYPES[0].value,
  )
  const [tools, setTools] = useState(scene?.tools || ['catalog'])
  const [error, setError] = useState('')
  const { pending: saving, error: saveError, run } = useAsyncAction()
  const availableTools = scene ? sceneToolsFor(scene) : sceneToolsFor(null)

  function toggleTool(value) {
    setTools((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('请输入场景名称')
      return
    }
    setError('')
    await run(async () => {
      if (scene) {
        await updateScene(scene.id, { name: name.trim(), type, tools })
      } else {
        await createScene({ name: name.trim(), type, tools })
      }
      onClose()
    })
  }

  return (
    <Modal
      title={scene ? '编辑场景' : '新建场景'}
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button type="submit" form="scene-form" className="btn btn-primary" disabled={saving}>
            {saving ? '正在保存…' : '保存'}
          </button>
        </>
      }
    >
      <form id="scene-form" onSubmit={handleSubmit}>
        <fieldset className="stack-form form-fields" disabled={saving}>
          <FormRow label="名称">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：宝可梦朱紫"
              autoFocus
            />
          </FormRow>
          <FormRow label="类型" hint={SCENE_TYPES.find((t) => t.value === type)?.description}>
            <div className="scene-type-options">
              {SCENE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`scene-type-button ${type === t.value ? 'active' : ''}`}
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
              {availableTools.map((tool) => (
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
          {(error || saveError) && <p className="form-error" role="alert">{error || saveError}</p>}
        </fieldset>
      </form>
    </Modal>
  )
}
