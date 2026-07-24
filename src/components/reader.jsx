import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, Image, Lock, MapPin, ShieldCheck, Upload, X } from 'lucide-react'
import { getReadingState, saveReadingState } from '../db.js'
import { loadReadingPackage, loadReadingPackageCatalog } from '../data/readingPackages.js'
import {
  projectReadingPlaces,
  visibleReadingEntities,
} from '../domain/readingCompanion.js'

const PLACE_KIND_LABELS = {
  real: '真实地点',
  fictional: '虚构地点',
  prototype: '原型地点',
  approximate: '模糊区域',
}

function LoadingPanel({ message }) {
  return <div className="reader-loading">{message}</div>
}

function ReaderError({ message }) {
  return (
    <div className="reader-error" role="alert">
      <strong>阅读资料加载失败</strong>
      <span>{message}</span>
    </div>
  )
}

function ReadingMapPanel({ entities, currentChapterId, chapters }) {
  const places = useMemo(
    () => visibleReadingEntities(entities, currentChapterId, chapters)
      .filter((entity) => entity.kind === 'place'),
    [entities, currentChapterId, chapters],
  )
  const projectedPlaces = useMemo(() => projectReadingPlaces(places), [places])
  const [selectedPlaceId, setSelectedPlaceId] = useState('')
  const selectedPlace = places.find((place) => place.id === selectedPlaceId) || places[0] || null

  useEffect(() => {
    if (selectedPlaceId && !places.some((place) => place.id === selectedPlaceId)) {
      setSelectedPlaceId('')
    }
  }, [places, selectedPlaceId])

  return (
    <section className="reader-panel">
      <div className="reader-panel-heading">
        <div>
          <span className="reader-step">03</span>
          <h3>探索已读地点</h3>
        </div>
        <span className="reader-system-chip"><ShieldCheck size={13} /> 系统规则过滤</span>
      </div>
      {places.length === 0 ? (
        <div className="reader-map-empty">
          <MapPin size={24} />
          <strong>当前进度还没有可展示的已审计地点</strong>
          <p>这里只读取正式资料包，不会用临时推断或模型猜测填充地点。</p>
        </div>
      ) : (
        <div className="reader-map-layout">
          <div className="reader-map-canvas" aria-label="已读地点空间概览">
            <span className="reader-map-axis north">北</span>
            <span className="reader-map-axis south">南</span>
            {projectedPlaces.map((place) => {
              const entity = places.find((item) => item.id === place.id)
              return (
                <button
                  className={`reader-map-marker ${selectedPlace?.id === place.id ? 'active' : ''}`}
                  key={place.id}
                  type="button"
                  style={{ left: `${place.x}%`, top: `${place.y}%` }}
                  onClick={() => setSelectedPlaceId(place.id)}
                  aria-label={`查看${entity.name}`}
                >
                  <MapPin size={18} />
                  <span>{entity.name}</span>
                </button>
              )
            })}
            {projectedPlaces.length === 0 && (
              <div className="reader-map-unplaced">已出现的地点尚无可发布空间位置</div>
            )}
          </div>
          <div className="reader-place-list">
            {places.map((place) => (
              <button
                className={selectedPlace?.id === place.id ? 'active' : ''}
                key={place.id}
                type="button"
                onClick={() => setSelectedPlaceId(place.id)}
              >
                <strong>{place.name}</strong>
                <span>{PLACE_KIND_LABELS[place.placeKind] || '地点'}</span>
              </button>
            ))}
          </div>
          {selectedPlace && (
            <div className="reader-place-detail">
              <div>
                <strong>{selectedPlace.name}</strong>
                <span>{PLACE_KIND_LABELS[selectedPlace.placeKind] || '地点'}</span>
              </div>
              {selectedPlace.aliases?.length > 0 && (
                <p>别名：{selectedPlace.aliases.join('、')}</p>
              )}
              {selectedPlace.parentLabel && <p>地理层级：{selectedPlace.parentLabel}</p>}
              {selectedPlace.geometry ? (
                <p>
                  {selectedPlace.geometry.type === 'area' ? '区域中心约 ' : ''}
                  {selectedPlace.geometry.latitude.toFixed(4)}, {selectedPlace.geometry.longitude.toFixed(4)}
                  {selectedPlace.geometry.type === 'area' && ` · 半径约 ${selectedPlace.geometry.radiusKm} km`}
                </p>
              ) : (
                <p>资料包未发布可显示的位置。</p>
              )}
              <small>仅展示资料包中已审计的空间字段，不生成剧情解释。</small>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export function ReaderTool({ scene }) {
  const [catalog, setCatalog] = useState(null)
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [readingPackage, setReadingPackage] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [pendingChapterId, setPendingChapterId] = useState('')
  const [saveState, setSaveState] = useState('idle')
  const [excerpt, setExcerpt] = useState('')
  const [imageInput, setImageInput] = useState(null)

  useEffect(() => {
    let active = true
    loadReadingPackageCatalog()
      .then((entries) => {
        if (!active) return
        setCatalog(entries)
        setSelectedPackageId((current) => current || entries[0]?.id || '')
      })
      .catch((error) => {
        if (active) setLoadError(error?.message || '无法读取阅读资料目录')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const entry = catalog?.find((item) => item.id === selectedPackageId)
    if (!entry) return undefined
    let active = true
    setReadingPackage(null)
    setLoadError('')
    loadReadingPackage(entry)
      .then((pkg) => {
        if (active) setReadingPackage(pkg)
      })
      .catch((error) => {
        if (active) setLoadError(error?.message || '无法读取阅读资料包')
      })
    return () => { active = false }
  }, [catalog, selectedPackageId])

  useEffect(() => () => {
    if (imageInput?.url) URL.revokeObjectURL(imageInput.url)
  }, [imageInput])

  const editionId = readingPackage?.edition.id || ''
  const savedState = useLiveQuery(
    () => (editionId ? getReadingState(scene.id, editionId) : null),
    [scene.id, editionId],
  )
  const defaultChapterId = readingPackage?.chapters[0]?.id || ''
  const currentChapterId = pendingChapterId || savedState?.currentChapterId || defaultChapterId
  const currentChapter = readingPackage?.chapters.find((chapter) => chapter.id === currentChapterId)
  const progressPercent = readingPackage && currentChapter
    ? Math.round((currentChapter.number / readingPackage.chapters.length) * 100)
    : 0

  const editionSummary = useMemo(() => {
    if (!readingPackage) return ''
    const { edition } = readingPackage
    return `${edition.publisher} · ${edition.publishedAt.replace('-', '年')}月 · ISBN ${edition.isbn}`
  }, [readingPackage])

  async function changeChapter(chapterId) {
    setPendingChapterId(chapterId)
    setSaveState('saving')
    try {
      await saveReadingState(scene.id, editionId, {
        packageId: readingPackage.id,
        bookId: readingPackage.book.id,
        currentChapterId: chapterId,
      })
      setSaveState('saved')
    } catch {
      setSaveState('error')
    } finally {
      setPendingChapterId('')
    }
  }

  function chooseImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (imageInput?.url) URL.revokeObjectURL(imageInput.url)
    setImageInput({ name: file.name, url: URL.createObjectURL(file) })
    event.target.value = ''
  }

  function clearImage() {
    if (imageInput?.url) URL.revokeObjectURL(imageInput.url)
    setImageInput(null)
  }

  if (loadError) return <ReaderError message={loadError} />
  if (!catalog || !readingPackage) return <LoadingPanel message="正在加载阅读资料…" />

  return (
    <div className="reader-tool">
      <section className="reader-hero">
        <div className="reader-hero-copy">
          <span className="reader-eyebrow"><BookOpen size={15} /> 经典文学阅读伴侣</span>
          <h2>{readingPackage.book.title}</h2>
          <p>{readingPackage.book.author} · {readingPackage.edition.translators.join('、')} 译</p>
          <small>{editionSummary}</small>
        </div>
        <div className="reader-progress-card">
          <span>当前阅读进度</span>
          <strong>{currentChapter?.label || '未选择'}</strong>
          <div className="reader-progress-track" aria-label={`阅读进度 ${progressPercent}%`}>
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <small>
            共 {readingPackage.chapters.length} 章
            {saveState === 'saving' && ' · 保存中…'}
            {saveState === 'saved' && ' · 已保存到本机'}
            {saveState === 'error' && ' · 保存失败'}
          </small>
        </div>
      </section>

      <div className="reader-layout">
        <main className="reader-main">
          <section className="reader-panel">
            <div className="reader-panel-heading">
              <div>
                <span className="reader-step">01</span>
                <h3>设置阅读边界</h3>
              </div>
              <span className="reader-safe-chip"><ShieldCheck size={14} /> 严格无剧透</span>
            </div>
            <div className="reader-controls">
              <label>
                <span>书籍版本</span>
                <select value={selectedPackageId} onChange={(event) => setSelectedPackageId(event.target.value)}>
                  {catalog.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.title} · {entry.editionLabel}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>我已经读到</span>
                <select value={currentChapterId} onChange={(event) => changeChapter(event.target.value)}>
                  {readingPackage.chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>{chapter.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="reader-help">资料查询只允许使用这一章及之前可以揭示的内容。修改进度会保存在当前设备。</p>
          </section>

          <section className="reader-panel">
            <div className="reader-panel-heading">
              <div>
                <span className="reader-step">02</span>
                <h3>放入正在阅读的内容</h3>
              </div>
              <span className="reader-local-chip"><Lock size={13} /> 仅在本机</span>
            </div>
            <label className="reader-excerpt-field">
              <span>粘贴当前段落</span>
              <textarea
                className="textarea"
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                placeholder="从微信读书复制一小段文字，后续将从这里识别人名、地名和时代概念…"
                rows={7}
              />
              <small>{excerpt.length} 字 · 当前不会上传或持久化这段文字</small>
            </label>

            <div className="reader-upload">
              <div className="reader-upload-copy">
                <Image size={20} />
                <div>
                  <strong>也可以放入页面截图</strong>
                  <span>截图只做本地预览；OCR 尚未接入。</span>
                </div>
              </div>
              <label className="btn">
                <Upload size={15} />
                选择截图
                <input type="file" accept="image/*" onChange={chooseImage} hidden />
              </label>
            </div>
            {imageInput && (
              <div className="reader-image-preview">
                <img src={imageInput.url} alt="所选阅读页面预览" />
                <div>
                  <span>{imageInput.name}</span>
                  <button type="button" className="icon-btn" onClick={clearImage} aria-label="移除截图">
                    <X size={15} />
                  </button>
                </div>
              </div>
            )}

            <div className="reader-analysis-placeholder">
              <ShieldCheck size={22} />
              <div>
                <strong>未来模型能力 · 尚未接入</strong>
                <p>实体识别会在地点与人物资料完成审计后开放，避免用未校验结果误导阅读。</p>
              </div>
            </div>
          </section>

          <ReadingMapPanel
            entities={readingPackage.entities}
            currentChapterId={currentChapterId}
            chapters={readingPackage.chapters}
          />
        </main>

        <aside className="reader-sidebar">
          <section className="reader-sidebar-card">
            <h3><MapPin size={17} /> 地图资料</h3>
            <strong>
              {visibleReadingEntities(
                readingPackage.entities,
                currentChapterId,
                readingPackage.chapters,
              ).filter((entity) => entity.kind === 'place').length} 个当前可见地点
            </strong>
            <p>数量按已读章节确定性过滤；正式《飘》地点资料仍待版本证据。</p>
          </section>
          <section className="reader-sidebar-card">
            <h3><ShieldCheck size={17} /> 剧透门禁</h3>
            <ul className="reader-risk-list">
              <li><span className="reader-risk-dot safe" />纯空间事实直接展示</li>
              <li><span className="reader-risk-dot potential" />潜在剧透先强提醒</li>
              <li><span className="reader-risk-dot high" />高风险内容二次确认</li>
            </ul>
            <p>授权只对当前一次内容有效，未知风险按潜在剧透处理。</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
