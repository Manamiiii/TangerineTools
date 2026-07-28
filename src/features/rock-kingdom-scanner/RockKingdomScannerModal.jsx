import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, FileImage, ScanLine, Settings2, Sparkles, Trash2, Video } from 'lucide-react'
import { createRow, db } from '../../db.js'
import { FieldInput } from '../../components/catalog.jsx'
import { FormRow, Modal } from '../../components/common.jsx'
import { recognizeReadingMetadataImage } from '../reading-companion/ocr/localOcr.js'
import { captureVideoFrame, cropImageSource, loadImageSource } from './frameCapture.js'
import {
  ROCK_SCANNER_CROP_PROFILE,
  bestScanMatch,
  catalogNameCandidates,
  rankScanCandidates,
  scannerOptionCandidates,
  valuesWithAppearance,
} from '../../domain/rockKingdomScanner.js'
import { ModelSettingsModal } from '../model/ModelSettingsModal.jsx'
import { MODEL_CONFIG_SCOPE, modelConfigIsComplete } from '../model/modelConfig.js'
import { useModelConfig } from '../model/useModelConfig.js'
import { correctRockScannerFields } from '../rock-kingdom-model/rockKingdomModel.js'

function frameId() {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? seconds : 0
  const minutes = Math.floor(safe / 60)
  const remainder = Math.floor(safe % 60)
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

function waitForSeek(video, time) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('读取视频画面失败。'))
    }
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.currentTime = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.05))
  })
}

function initialDraft(fields) {
  return Object.fromEntries(fields.map((field) => [
    field.key,
    field.type === 'multiselect' ? [] : field.type === 'boolean' ? false : '',
  ]))
}

function fieldByKey(fields, key) {
  return fields.find((field) => field.key === key)
}

function recognizedPatch(raw, fields, nameCandidates) {
  const patch = {}
  const confidence = {}
  const matchers = {
    ref: nameCandidates,
    nature: scannerOptionCandidates(fieldByKey(fields, 'nature')),
    bloodline: scannerOptionCandidates(fieldByKey(fields, 'bloodline')),
    specialty: scannerOptionCandidates(fieldByKey(fields, 'specialty')),
  }
  for (const [key, candidates] of Object.entries(matchers)) {
    const match = bestScanMatch(raw[key], candidates)
    if (!match) continue
    patch[key] = match.value
    confidence[key] = match.score
  }
  return { patch, confidence }
}

export function RockKingdomScannerModal({ table, fields, onClose }) {
  const videoRef = useRef(null)
  const objectUrlsRef = useRef(new Set())
  const ownedDefaults = useMemo(() => initialDraft(fields), [fields])
  const refField = fieldByKey(fields, 'ref')
  const catalogRows = useLiveQuery(
    () => refField?.referenceTableId
      ? db.catalogRows.where('tableId').equals(refField.referenceTableId).toArray()
      : [],
    [refField?.referenceTableId || ''],
  )
  const catalogFields = useLiveQuery(
    () => refField?.referenceTableId
      ? db.catalogFields.where('tableId').equals(refField.referenceTableId).sortBy('order')
      : [],
    [refField?.referenceTableId || ''],
  )
  const nameCandidates = useMemo(
    () => catalogNameCandidates(catalogRows || [], catalogFields || []),
    [catalogRows, catalogFields],
  )
  const [videoUrl, setVideoUrl] = useState('')
  const [videoName, setVideoName] = useState('')
  const [frames, setFrames] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [intervalSeconds, setIntervalSeconds] = useState(2)
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false)
  const {
    modelConfig,
    loadProvider,
    canCopyOtherConfig,
    loadOtherConfig,
    saveModelConfig,
  } = useModelConfig(MODEL_CONFIG_SCOPE.ROCK_KINGDOM)

  const selected = frames.find((frame) => frame.id === selectedId) || frames[0]

  useEffect(() => {
    if (!selectedId && frames[0]) setSelectedId(frames[0].id)
  }, [frames, selectedId])

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current.clear()
  }, [])

  function createLocalUrl(blob) {
    const url = URL.createObjectURL(blob)
    objectUrlsRef.current.add(url)
    return url
  }

  function releaseLocalUrl(url) {
    if (!url) return
    URL.revokeObjectURL(url)
    objectUrlsRef.current.delete(url)
  }

  function addFrames(items) {
    setFrames((current) => [...current, ...items])
    if (!selectedId && items[0]) setSelectedId(items[0].id)
  }

  function addImageFiles(files) {
    const items = [...files].map((file) => ({
      id: frameId(),
      url: createLocalUrl(file),
      sourceName: file.name,
      time: null,
      values: { ...ownedDefaults, appearance: 'none' },
      raw: {},
      confidence: {},
      status: '待识别',
    }))
    addFrames(items)
  }

  async function addCurrentVideoFrame() {
    setError('')
    try {
      const captured = await captureVideoFrame(videoRef.current)
      addFrames([{
        id: frameId(),
        url: createLocalUrl(captured.blob),
        sourceName: videoName,
        time: captured.time,
        width: captured.width,
        height: captured.height,
        values: { ...ownedDefaults, appearance: 'none' },
        raw: {},
        confidence: {},
        status: '待识别',
      }])
    } catch (captureError) {
      setError(captureError.message)
    }
  }

  async function extractAtInterval() {
    const video = videoRef.current
    if (!video?.duration) {
      setError('请先选择并加载一个视频。')
      return
    }
    const count = Math.min(300, Math.ceil(video.duration / intervalSeconds))
    setBusy('extract')
    setError('')
    const items = []
    try {
      for (let index = 0; index < count; index += 1) {
        const time = Math.min(video.duration - 0.05, index * intervalSeconds)
        setProgress(`正在提取 ${index + 1} / ${count}`)
        await waitForSeek(video, time)
        const captured = await captureVideoFrame(video)
        items.push({
          id: frameId(),
          url: createLocalUrl(captured.blob),
          sourceName: videoName,
          time,
          width: captured.width,
          height: captured.height,
          values: { ...ownedDefaults, appearance: 'none' },
          raw: {},
          confidence: {},
          status: '待识别',
        })
      }
      addFrames(items)
      if (Math.ceil(video.duration / intervalSeconds) > 300) {
        setProgress('本次已提取前 300 帧；可调大间隔后重新导入长视频。')
      } else {
        setProgress(`已提取 ${items.length} 帧，请删除切换动画和重复画面。`)
      }
    } catch (extractError) {
      items.forEach((item) => releaseLocalUrl(item.url))
      setError(extractError.message)
    } finally {
      setBusy('')
    }
  }

  function patchFrame(id, patch) {
    setFrames((current) => current.map((frame) => frame.id === id ? { ...frame, ...patch } : frame))
  }

  function patchFrameValue(id, key, value) {
    setFrames((current) => current.map((frame) => frame.id === id
      ? {
          ...frame,
          values: { ...frame.values, [key]: value },
          confidence: { ...frame.confidence, [key]: 1 },
          status: '已复核',
        }
      : frame))
  }

  async function recognizeFrame(frame) {
    patchFrame(frame.id, { status: '识别中' })
    const image = await loadImageSource(frame.url)
    const raw = {}
    for (const key of ['name', 'bloodline', 'nature', 'specialty']) {
      setProgress(`正在识别 ${frame.sourceName}${frame.time == null ? '' : ` ${formatTime(frame.time)}`} · ${ROCK_SCANNER_CROP_PROFILE[key].label}`)
      const crop = cropImageSource(image, ROCK_SCANNER_CROP_PROFILE[key])
      raw[key === 'name' ? 'ref' : key] = await recognizeReadingMetadataImage(crop)
    }
    const matched = recognizedPatch(raw, fields, nameCandidates)
    patchFrame(frame.id, {
      raw,
      confidence: matched.confidence,
      values: { ...frame.values, ...matched.patch },
      status: matched.patch.ref ? '待复核' : '未匹配精灵',
    })
  }

  async function recognizeSelected() {
    if (!selected) return
    setBusy('ocr')
    setError('')
    try {
      await recognizeFrame(selected)
      setProgress('识别完成。请核对所有字段，外观和性别需要手动选择。')
    } catch (recognizeError) {
      patchFrame(selected.id, { status: '识别失败' })
      setError(recognizeError.message)
    } finally {
      setBusy('')
    }
  }

  async function recognizeAll() {
    if (frames.length === 0) return
    setBusy('ocr-all')
    setError('')
    try {
      for (let index = 0; index < frames.length; index += 1) {
        setProgress(`批量识别 ${index + 1} / ${frames.length}`)
        await recognizeFrame(frames[index])
      }
      setProgress('批量识别完成。保存前请逐条复核。')
    } catch (recognizeError) {
      setError(recognizeError.message)
    } finally {
      setBusy('')
    }
  }

  function correctionFields(frame) {
    const candidateSets = {
      ref: nameCandidates,
      nature: scannerOptionCandidates(fieldByKey(fields, 'nature')),
      bloodline: scannerOptionCandidates(fieldByKey(fields, 'bloodline')),
      specialty: scannerOptionCandidates(fieldByKey(fields, 'specialty')),
    }
    return Object.entries(candidateSets).flatMap(([key, candidates]) => {
      const rawText = frame.raw?.[key] || ''
      const confidence = Number(frame.confidence?.[key]) || 0
      if (!rawText || (frame.values?.[key] && confidence >= 0.78)) return []
      return [{
        key,
        rawText,
        candidates: rankScanCandidates(rawText, candidates).slice(0, 16),
      }]
    })
  }

  async function correctSelectedWithModel() {
    if (!selected) return
    if (!modelConfigIsComplete(modelConfig)) {
      setModelSettingsOpen(true)
      return
    }
    setBusy('model')
    setError('')
    try {
      const corrections = await correctRockScannerFields({
        config: modelConfig,
        fields: correctionFields(selected),
      })
      const nextValues = { ...selected.values }
      const nextConfidence = { ...selected.confidence }
      corrections.forEach((item) => {
        nextValues[item.key] = item.value
        nextConfidence[item.key] = item.confidence
      })
      patchFrame(selected.id, {
        values: nextValues,
        confidence: nextConfidence,
        status: 'AI 已补全，待复核',
      })
      setProgress(`模型补全了 ${corrections.length} 个低置信字段；请人工核对后保存。`)
    } catch (modelError) {
      setError(modelError.message)
    } finally {
      setBusy('')
    }
  }

  function removeFrame(frame) {
    releaseLocalUrl(frame.url)
    setFrames((current) => current.filter((item) => item.id !== frame.id))
    if (selectedId === frame.id) setSelectedId('')
  }

  async function saveReviewed() {
    const ready = frames.filter((frame) => frame.values.ref)
    if (ready.length === 0) {
      setError('至少需要为一帧确认精灵名称。')
      return
    }
    setBusy('save')
    setError('')
    try {
      for (let index = 0; index < ready.length; index += 1) {
        setProgress(`正在写入 ${index + 1} / ${ready.length}`)
        await createRow(table.id, valuesWithAppearance(ready[index].values))
      }
      setProgress(`已写入 ${ready.length} 条收集记录。`)
      setFrames((current) => current.filter((frame) => {
        if (!frame.values.ref) return true
        releaseLocalUrl(frame.url)
        return false
      }))
      setSelectedId('')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy('')
    }
  }

  const editableKeys = ['ref', 'nature', 'bloodline', 'appearance', 'specialty', 'gender']
  const editableFields = editableKeys.map((key) => fieldByKey(fields, key)).filter(Boolean)
  const readyCount = frames.filter((frame) => frame.values.ref).length

  return (
    <Modal
      title="精灵扫描录入"
      onClose={onClose}
      width={1180}
      footer={
        <>
          <span className="scanner-footer-status">{progress || `已加入 ${frames.length} 帧，${readyCount} 帧可保存`}</span>
          <button type="button" className="btn" onClick={onClose} disabled={Boolean(busy)}>关闭</button>
          <button type="button" className="btn btn-primary" onClick={saveReviewed} disabled={Boolean(busy) || readyCount === 0}>
            写入 {readyCount || ''} 条记录
          </button>
        </>
      }
    >
      <div className="scanner-shell">
        <details className="scanner-guide" open>
          <summary>Windows 录屏与文件位置</summary>
          <ol>
            <li>在游戏里打开精灵总览页，按 <kbd>Win</kbd> + <kbd>Alt</kbd> + <kbd>R</kbd> 开始录制；结束时再按一次。</li>
            <li>每只精灵停留约 2 秒，只需要手动切换，不要使用连点器、按键脚本或自动操作。</li>
            <li>Xbox Game Bar 默认保存到“此电脑 → 视频 → 捕获”，通常是 <code>%USERPROFILE%\Videos\Captures</code>。</li>
            <li>也可以用 OBS 录制；在 OBS 的“设置 → 输出 → 录像路径”查看文件位置。</li>
            <li>导入后按间隔提取画面，先删除切换动画和重复帧，再进行 OCR 与人工复核。</li>
          </ol>
          <p>视频、截图和 OCR 默认只在当前浏览器本地处理，原媒体不会写入 IndexedDB。只有点击“AI 纠错”时，当前帧的低置信 OCR 文字和有限候选会发送给已配置模型，图片不会发送。</p>
        </details>

        <div className="scanner-import-row">
          <label className="btn">
            <Video size={15} />
            选择视频
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                releaseLocalUrl(videoUrl)
                setVideoUrl(createLocalUrl(file))
                setVideoName(file.name)
                event.target.value = ''
              }}
            />
          </label>
          <label className="btn">
            <FileImage size={15} />
            选择截图
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => {
                addImageFiles(event.target.files || [])
                event.target.value = ''
              }}
            />
          </label>
          <label className="scanner-interval">
            <span>提取间隔</span>
            <input
              className="input"
              type="number"
              min="0.5"
              max="30"
              step="0.5"
              value={intervalSeconds}
              onChange={(event) => setIntervalSeconds(Math.max(0.5, Number(event.target.value) || 2))}
            />
            <span>秒</span>
          </label>
          <button type="button" className="btn" disabled={!videoUrl || Boolean(busy)} onClick={extractAtInterval}>
            按间隔提取
          </button>
        </div>

        {videoUrl && (
          <div className="scanner-video">
            <video ref={videoRef} src={videoUrl} controls preload="metadata" />
            <button type="button" className="btn" onClick={addCurrentVideoFrame} disabled={Boolean(busy)}>
              <Camera size={15} /> 添加当前画面
            </button>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        <div className="scanner-workspace">
          <aside className="scanner-frame-list">
            <div className="scanner-frame-heading">
              <strong>候选画面</strong>
              <span>{frames.length}</span>
            </div>
            {frames.length === 0 ? (
              <p>选择截图，或从视频提取画面。</p>
            ) : frames.map((frame, index) => (
              <button
                type="button"
                key={frame.id}
                className={`scanner-frame-item ${selected?.id === frame.id ? 'active' : ''}`}
                onClick={() => setSelectedId(frame.id)}
              >
                <img src={frame.url} alt="" />
                <span>
                  <strong>#{index + 1} {frame.time == null ? '' : formatTime(frame.time)}</strong>
                  <small>{frame.status}</small>
                </span>
              </button>
            ))}
          </aside>

          <section className="scanner-review">
            {!selected ? (
              <div className="scanner-empty">
                <ScanLine size={28} />
                <strong>加入一个画面后开始复核</strong>
                <span>目前的裁切位置按你提供的总览截图标定，Windows 实机截图到位后还会继续校准。</span>
              </div>
            ) : (
              <>
                <div
                  className="scanner-preview"
                  style={{
                    width: `min(100%, ${Math.round(360 * ((selected.width || 16) / (selected.height || 9)))}px)`,
                    aspectRatio: `${selected.width || 16} / ${selected.height || 9}`,
                  }}
                >
                  <img
                    src={selected.url}
                    alt="待识别的精灵画面"
                    onLoad={(event) => {
                      const image = event.currentTarget
                      if (selected.width === image.naturalWidth && selected.height === image.naturalHeight) return
                      patchFrame(selected.id, { width: image.naturalWidth, height: image.naturalHeight })
                    }}
                  />
                  {Object.entries(ROCK_SCANNER_CROP_PROFILE).map(([key, crop]) => (
                    <i
                      key={key}
                      title={crop.label}
                      style={{
                        left: `${crop.x * 100}%`,
                        top: `${crop.y * 100}%`,
                        width: `${crop.width * 100}%`,
                        height: `${crop.height * 100}%`,
                      }}
                    >
                      {crop.label}
                    </i>
                  ))}
                </div>
                <div className="scanner-review-actions">
                  <button type="button" className="btn btn-primary" onClick={recognizeSelected} disabled={Boolean(busy)}>
                    <ScanLine size={15} /> 识别当前画面
                  </button>
                  <button type="button" className="btn" onClick={recognizeAll} disabled={Boolean(busy) || frames.length === 0}>
                    识别全部
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={correctSelectedWithModel}
                    disabled={Boolean(busy) || correctionFields(selected).length === 0}
                    title={correctionFields(selected).length === 0 ? '先运行本机 OCR；只有未匹配或低置信字段才会发送' : ''}
                  >
                    <Sparkles size={15} /> {busy === 'model' ? '纠错中…' : 'AI 纠错低置信字段'}
                  </button>
                  <button type="button" className="btn btn-icon" title="模型设置" onClick={() => setModelSettingsOpen(true)} disabled={Boolean(busy)}>
                    <Settings2 size={15} />
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => removeFrame(selected)} disabled={Boolean(busy)}>
                    <Trash2 size={15} /> 删除画面
                  </button>
                </div>
                <div className="scanner-fields">
                  {editableFields.map((field) => (
                    <FormRow key={field.id} label={field.name}>
                      <FieldInput
                        field={field}
                        value={selected.values[field.key]}
                        onChange={(value) => patchFrameValue(selected.id, field.key, value)}
                      />
                      {selected.raw[field.key] && (
                        <small className="scanner-ocr-raw">
                          OCR：{selected.raw[field.key]}
                          {selected.confidence[field.key] ? ` · 匹配 ${Math.round(selected.confidence[field.key] * 100)}%` : ''}
                        </small>
                      )}
                    </FormRow>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
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
