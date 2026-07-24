import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Eye,
  EyeOff,
  Image,
  LibraryBig,
  Lock,
  MapPin,
  Plus,
  ScanSearch,
  ShieldCheck,
  Trash2,
  Upload,
  UserRoundSearch,
  X,
} from 'lucide-react'
import { getReadingState, saveReadingState } from '../db/readingState.js'
import { loadReadingPackage, loadReadingPackageCatalog } from '../data/readingPackages.js'
import { ReadingGeoMap } from './ReadingGeoMap.jsx'
import { generateId } from '../../../utils.js'
import {
  SPOILER_GATE_ACTION,
  SPOILER_CATEGORY_LABELS,
  SPOILER_RISK,
  canRevealRisk,
  OBSERVED_ENTITY_KIND,
  matchOnDemandEntity,
  readingPlaceRelations,
  scanOnDemandEntities,
  spoilerGateAction,
  unlockedOnDemandEntities,
  upsertObservedEntity,
  visibleReadingEntities,
  visibleReadingFacts,
  visibleObservedEntities,
} from '../domain/readingCompanion.js'

const PLACE_KIND_LABELS = {
  real: '真实地点',
  fictional: '虚构地点',
  prototype: '原型地点',
  approximate: '模糊区域',
}

const OBSERVED_KIND_LABELS = {
  [OBSERVED_ENTITY_KIND.PLACE]: '地点',
  [OBSERVED_ENTITY_KIND.PERSON]: '人物',
  [OBSERVED_ENTITY_KIND.CONCEPT]: '概念',
  [OBSERVED_ENTITY_KIND.EVENT]: '事件',
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

function ReadingLibrary({ catalog, onSelect }) {
  return (
    <div className="reader-tool reader-library">
      <section className="reader-library-hero">
        <span className="reader-eyebrow"><LibraryBig size={15} /> 经典文学阅读伴侣</span>
        <h2>选择一本书</h2>
        <p>每本书拥有独立的版本资料、阅读进度和已遇到名称。</p>
      </section>
      <section className="reader-library-panel">
        <div className="reader-library-heading">
          <div>
            <h3>我的书架</h3>
            <span>{catalog.length} 本已准备</span>
          </div>
          <small>选择后进入该书的阅读空间</small>
        </div>
        {catalog.length > 0 ? (
          <div className="reader-book-grid">
            {catalog.map((entry) => (
              <button
                className="reader-book-card"
                key={entry.id}
                type="button"
                onClick={() => onSelect(entry.id)}
              >
                <span className="reader-book-cover"><BookOpen size={26} /></span>
                <span className="reader-book-copy">
                  <strong>{entry.title}</strong>
                  <small>{entry.editionLabel}</small>
                  <b>开始阅读</b>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="reader-observed-empty">还没有已发布的书籍资料包。</div>
        )}
      </section>
      <section className="reader-trial-panel">
        <div className="reader-trial-heading">
          <div>
            <span className="reader-safe-chip"><ShieldCheck size={14} /> 核心流程可试用</span>
            <h3>第一次怎么用</h3>
          </div>
          <p>不需要上传整本书，也不需要配置模型。</p>
        </div>
        <ol className="reader-trial-steps">
          <li>
            <span>1</span>
            <div><strong>选择正在读的书</strong><small>进入后把进度设为实际章节。</small></div>
          </li>
          <li>
            <span>2</span>
            <div><strong>粘贴刚读到的一小段</strong><small>文字只在当前页面处理，不会保存。</small></div>
          </li>
          <li>
            <span>3</span>
            <div><strong>扫描并确认名称</strong><small>只显示段落里真正命中的已审计名称。</small></div>
          </li>
          <li>
            <span>4</span>
            <div><strong>查看已解锁资料</strong><small>地点分类与安全空间资料受阅读进度约束。</small></div>
          </li>
        </ol>
        <div className="reader-trial-boundary">
          <div>
            <strong>本次可以测试</strong>
            <span>书架、章节进度、文本扫描、名称记录、地点解锁、本机保存</span>
          </div>
          <div>
            <strong>暂未开放</strong>
            <span>截图 OCR、自由问答、人物关系理解、自动发现未知名称</span>
          </div>
        </div>
      </section>
    </div>
  )
}

function ObservedEntitiesPanel({
  observedEntities,
  onDemandEntities,
  currentChapterId,
  currentChapter,
  chapters,
  onChange,
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState(OBSERVED_ENTITY_KIND.PLACE)
  const [status, setStatus] = useState('')
  const visibleEntities = useMemo(
    () => visibleObservedEntities(observedEntities, currentChapterId, chapters),
    [observedEntities, currentChapterId, chapters],
  )
  const hiddenCount = observedEntities.length - visibleEntities.length

  async function addObservedEntity(event) {
    event.preventDefault()
    setStatus('')
    try {
      const next = upsertObservedEntity(observedEntities, {
        id: generateId('observed'),
        name,
        kind,
        firstSeenChapterId: currentChapterId,
      }, chapters)
      if (next === observedEntities) {
        setStatus('这个名称已经记录在当前章或更早章节。')
        return
      }
      await onChange(next)
      setName('')
      setStatus(`已把首次遇到位置记在${currentChapter?.label || '当前章'}。`)
    } catch (error) {
      setStatus(error?.message || '保存失败')
    }
  }

  async function removeObservedEntity(id) {
    setStatus('')
    try {
      await onChange(observedEntities.filter((entity) => entity.id !== id))
    } catch (error) {
      setStatus(error?.message || '删除失败')
    }
  }

  return (
    <section className="reader-panel">
      <div className="reader-panel-heading">
        <div>
          <span className="reader-step">03</span>
          <h3>记录本章遇到的名字</h3>
        </div>
        <span className="reader-local-chip"><Lock size={13} /> 用户确认</span>
      </div>
      <p className="reader-help reader-observed-intro">
        没有原文预分析时，章节仍可记录“你到这里已经遇到它”。这里只保存你主动输入的名称，不自动补充人物关系或剧情。
      </p>
      <form className="reader-observed-form" onSubmit={addObservedEntity}>
        <label>
          <span>名称</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：刚刚读到的人名或地名"
            maxLength={120}
          />
        </label>
        <label>
          <span>类型</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            {Object.entries(OBSERVED_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn reader-observed-add" disabled={!name.trim()}>
          <Plus size={15} /> 记在{currentChapter?.label || '当前章'}
        </button>
      </form>
      {status && <p className="reader-observed-status" role="status">{status}</p>}
      {visibleEntities.length > 0 ? (
        <div className="reader-observed-list">
          {visibleEntities.map((entity) => {
            const chapter = chapters.find((item) => item.id === entity.firstSeenChapterId)
            const match = matchOnDemandEntity(onDemandEntities, entity.name, entity.kind)
            return (
              <div className="reader-observed-item" key={entity.id}>
                <UserRoundSearch size={16} />
                <div>
                  <strong>{entity.name}</strong>
                  <span>{OBSERVED_KIND_LABELS[entity.kind]} · 首次记录于{chapter?.label || '未知章节'}</span>
                  {match && (
                    <div className="reader-observed-match">
                      <b>已精确匹配公开候选</b>
                      <span>
                        {match.name !== entity.name ? `资料名：${match.name} · ` : ''}
                        {match.kind === 'place' ? PLACE_KIND_LABELS[match.placeKind] : OBSERVED_KIND_LABELS[match.kind]}
                      </span>
                      {match.parentLabel && <span>{match.parentLabel}</span>}
                      {match.scopeNote && <small>{match.scopeNote}</small>}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => removeObservedEntity(entity.id)}
                  aria-label={`删除${entity.name}的遇见记录`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="reader-observed-empty">当前章及之前还没有手动记录的名称。</div>
      )}
      {hiddenCount > 0 && (
        <p className="reader-observed-hidden">
          有 {hiddenCount} 条较后章节的记录已隐藏，回到相应进度后才会显示名称。
        </p>
      )}
    </section>
  )
}

function ReadingMapPanel({ entities, currentChapterId, chapters }) {
  const places = useMemo(
    () => visibleReadingEntities(entities, currentChapterId, chapters)
      .filter((entity) => entity.kind === 'place'),
    [entities, currentChapterId, chapters],
  )
  const spatialPlaces = useMemo(
    () => places.filter((place) => (
      Number.isFinite(place.geometry?.latitude)
      && Number.isFinite(place.geometry?.longitude)
    )),
    [places],
  )
  const [selectedPlaceId, setSelectedPlaceId] = useState('')
  const selectedPlace = places.find((place) => place.id === selectedPlaceId) || places[0] || null
  const placeRelations = useMemo(
    () => readingPlaceRelations(places, selectedPlace?.id),
    [places, selectedPlace?.id],
  )

  useEffect(() => {
    if (selectedPlaceId && !places.some((place) => place.id === selectedPlaceId)) {
      setSelectedPlaceId('')
    }
  }, [places, selectedPlaceId])

  return (
    <section className="reader-panel">
      <div className="reader-panel-heading">
        <div>
          <span className="reader-step">04</span>
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
          {spatialPlaces.length > 0 ? (
            <ReadingGeoMap
              places={spatialPlaces}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={setSelectedPlaceId}
            />
          ) : (
            <div className="reader-map-unplaced">
              <MapPin size={22} />
              <strong>已出现的地点没有可发布坐标</strong>
              <span>虚构或位置不明确的地点不会被强行放到现实地图上。</span>
            </div>
          )}
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
              {selectedPlace.accessMode === 'reader-confirmed-exact-match' && (
                <p className="reader-place-unlock-note">
                  由你输入“{selectedPlace.readerConfirmedName}”后精确解锁，不是系统预判的出现章节。
                </p>
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
              {selectedPlace.scopeNote && <p>{selectedPlace.scopeNote}</p>}
              {placeRelations.length > 0 && (
                <div className="reader-place-relations">
                  <strong>与其他已读地点</strong>
                  {placeRelations.map((relation) => (
                    <span key={relation.id}>
                      {relation.name}：{relation.direction}方向 · 直线约{' '}
                      {relation.distanceKm < 10
                        ? relation.distanceKm.toFixed(1)
                        : Math.round(relation.distanceKm)} 公里
                    </span>
                  ))}
                </div>
              )}
              <small>仅展示资料包中已审计的空间字段，不生成剧情解释。</small>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function ReadingFactContent({ fact, entities, onHide }) {
  const entityNames = fact.entityIds
    .map((entityId) => entities.find((entity) => entity.id === entityId)?.name)
    .filter(Boolean)
  return (
    <div className={`reader-fact-content ${fact.riskLevel}`}>
      <p>{fact.content}</p>
      {entityNames.length > 0 && <small>相关实体：{entityNames.join('、')}</small>}
      {fact.riskLevel !== SPOILER_RISK.SAFE && (
        <button type="button" className="btn btn-sm" onClick={onHide}>
          <EyeOff size={13} /> 收起并撤销本次授权
        </button>
      )}
    </div>
  )
}

function ReadingFactsPanel({ facts, entities, currentChapterId, currentChapter, chapters }) {
  const visibleFacts = useMemo(
    () => visibleReadingFacts(facts, currentChapterId, chapters),
    [facts, currentChapterId, chapters],
  )
  const [gateStates, setGateStates] = useState({})

  function setGateState(factId, state) {
    setGateStates((current) => ({ ...current, [factId]: state }))
  }

  function riskCategories(fact) {
    return fact.riskCategories.map(
      (category) => SPOILER_CATEGORY_LABELS[category] || '未分类风险',
    )
  }

  return (
    <section className="reader-panel">
      <div className="reader-panel-heading">
        <div>
          <span className="reader-step">05</span>
          <h3>查看已读资料</h3>
        </div>
        <span className="reader-system-chip"><ShieldCheck size={13} /> 确定性剧透门禁</span>
      </div>
      {visibleFacts.length === 0 ? (
        <div className="reader-facts-empty">
          <ShieldCheck size={24} />
          <strong>当前没有可展示的正式事实</strong>
          <p>测试夹具和临时研究不会出现在这里；只有通过发布流程的已审计事实才会进入门禁。</p>
        </div>
      ) : (
        <div className="reader-fact-list">
          {visibleFacts.map((fact, index) => {
            const gateState = gateStates[fact.id] || 'hidden'
            const gateAction = spoilerGateAction(fact.riskLevel)
            const isSafe = gateAction === SPOILER_GATE_ACTION.DISPLAY
            const isRevealed = canRevealRisk(
              fact.riskLevel,
              gateState === 'revealed' ? fact.riskLevel : 'none',
            )
            return (
              <article className={`reader-fact-card ${fact.riskLevel}`} key={fact.id}>
                <div className="reader-fact-heading">
                  <strong>已审计说明 {index + 1}</strong>
                  <span>{isSafe ? '安全资料' : fact.riskLevel === SPOILER_RISK.HIGH ? '高风险' : '潜在剧透'}</span>
                </div>
                {isRevealed ? (
                  <ReadingFactContent
                    fact={fact}
                    entities={entities}
                    onHide={() => setGateState(fact.id, 'hidden')}
                  />
                ) : gateState === 'hidden' ? (
                  <div className="reader-fact-locked">
                    <EyeOff size={18} />
                    <p>已审计内容在确认前不会写入页面。</p>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setGateState(fact.id, 'warning')}
                    >
                      <Eye size={13} /> 请求查看
                    </button>
                  </div>
                ) : (
                  <div className={`reader-spoiler-warning ${gateState === 'confirming' ? 'high' : ''}`} role="alert">
                    <AlertTriangle size={20} />
                    <div>
                      <strong>
                        {gateState === 'confirming'
                          ? '请再次确认显示高风险内容'
                          : '以下内容可能涉及剧透'}
                      </strong>
                      <p>可能涉及：{riskCategories(fact).join('、')}。</p>
                      <small>当前阅读进度：{currentChapter?.label || '未知'}。</small>
                      <div className="reader-warning-actions">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setGateState(fact.id, 'hidden')}
                        >
                          保持隐藏
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => setGateState(
                            fact.id,
                            gateAction === SPOILER_GATE_ACTION.CONFIRM_TWICE
                              && gateState !== 'confirming'
                              ? 'confirming'
                              : 'revealed',
                          )}
                        >
                          {gateState === 'confirming' ? '确认显示' : '仍然查看'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
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
  const [scanResults, setScanResults] = useState([])
  const [scanPerformed, setScanPerformed] = useState(false)
  const [scanStatus, setScanStatus] = useState('')

  useEffect(() => {
    let active = true
    loadReadingPackageCatalog()
      .then((entries) => {
        if (!active) return
        setCatalog(entries)
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
  const observedEntities = savedState?.observedEntities || []
  const unlockedEntities = useMemo(
    () => unlockedOnDemandEntities(
      readingPackage?.onDemandEntities,
      observedEntities,
      currentChapterId,
      readingPackage?.chapters,
    ),
    [
      readingPackage?.onDemandEntities,
      readingPackage?.chapters,
      observedEntities,
      currentChapterId,
    ],
  )
  const visibleMapEntities = useMemo(
    () => [...(readingPackage?.entities || []), ...unlockedEntities],
    [readingPackage?.entities, unlockedEntities],
  )

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

  async function changeObservedEntities(observedEntities) {
    setSaveState('saving')
    try {
      await saveReadingState(scene.id, editionId, {
        packageId: readingPackage.id,
        bookId: readingPackage.book.id,
        observedEntities,
      })
      setSaveState('saved')
    } catch (error) {
      setSaveState('error')
      throw error
    }
  }

  function selectBook(packageId) {
    setSelectedPackageId(packageId)
    setPendingChapterId('')
    setExcerpt('')
    setScanResults([])
    setScanPerformed(false)
    setScanStatus('')
    clearImage()
  }

  function returnToLibrary() {
    setSelectedPackageId('')
    setReadingPackage(null)
    setPendingChapterId('')
    setExcerpt('')
    setScanResults([])
    setScanPerformed(false)
    setScanStatus('')
    clearImage()
  }

  function changeExcerpt(value) {
    setExcerpt(value)
    setScanResults([])
    setScanPerformed(false)
    setScanStatus('')
  }

  function scanExcerpt() {
    setScanResults(scanOnDemandEntities(excerpt, readingPackage.onDemandEntities || []))
    setScanPerformed(true)
    setScanStatus('')
  }

  async function confirmScannedEntity({ entity, matchedTerm }) {
    setScanStatus('')
    try {
      const next = upsertObservedEntity(observedEntities, {
        id: generateId('observed'),
        name: matchedTerm,
        kind: entity.kind,
        firstSeenChapterId: currentChapterId,
      }, readingPackage.chapters)
      if (next === observedEntities) {
        setScanStatus(`“${matchedTerm}”已经记录在当前章或更早章节。`)
        return
      }
      await changeObservedEntities(next)
      setScanStatus(`已确认“${matchedTerm}”出现在${currentChapter?.label || '当前章'}。`)
    } catch (error) {
      setScanStatus(error?.message || '保存扫描结果失败')
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
  if (!catalog) return <LoadingPanel message="正在加载阅读书架…" />
  if (!selectedPackageId) return <ReadingLibrary catalog={catalog} onSelect={selectBook} />
  if (!readingPackage) return <LoadingPanel message="正在加载阅读资料…" />

  return (
    <div className="reader-tool">
      <section className="reader-hero">
        <div className="reader-hero-copy">
          <button type="button" className="reader-back-button" onClick={returnToLibrary}>
            <ArrowLeft size={15} /> 返回书架
          </button>
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
            <div className="reader-controls reader-controls-single">
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
                onChange={(event) => changeExcerpt(event.target.value)}
                placeholder="从微信读书复制一小段文字，本机可以扫描其中已审计的名称…"
                rows={7}
              />
              <small>{excerpt.length} 字 · 当前不会上传或持久化这段文字</small>
            </label>
            <div className="reader-scan-actions">
              <button type="button" className="btn" onClick={scanExcerpt} disabled={!excerpt.trim()}>
                <ScanSearch size={15} /> 本机扫描已知名称
              </button>
              <span>只查找段落中实际出现的资料包名称，不会显示候选清单。</span>
            </div>
            {scanPerformed && (
              <div className="reader-scan-results" role="status">
                <div className="reader-scan-results-heading">
                  <strong>扫描结果</strong>
                  <span>{scanResults.length} 个精确命中</span>
                </div>
                {scanResults.length > 0 ? scanResults.map((result) => (
                  <div className="reader-scan-result" key={result.entity.id}>
                    <div>
                      <strong>{result.matchedTerm}</strong>
                      <span>
                        {result.entity.kind === OBSERVED_ENTITY_KIND.PLACE
                          ? PLACE_KIND_LABELS[result.entity.placeKind]
                          : OBSERVED_KIND_LABELS[result.entity.kind]}
                        {result.entity.name !== result.matchedTerm ? ` · 资料名 ${result.entity.name}` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => confirmScannedEntity(result)}
                    >
                      <Plus size={13} /> 确认记在{currentChapter?.label || '当前章'}
                    </button>
                  </div>
                )) : (
                  <p>当前段落没有命中资料包内已审计名称。系统不会据此猜测人物、地点或剧情。</p>
                )}
                {scanStatus && <p className="reader-scan-status">{scanStatus}</p>}
              </div>
            )}

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
                <strong>模型识别 · 尚未接入</strong>
                <p>当前精确扫描是确定性的本机能力；语义识别、上下文消歧和未知实体发现仍需要未来的模型适配器。</p>
              </div>
            </div>
          </section>

          <ObservedEntitiesPanel
            observedEntities={observedEntities}
            onDemandEntities={readingPackage.onDemandEntities || []}
            currentChapterId={currentChapterId}
            currentChapter={currentChapter}
            chapters={readingPackage.chapters}
            onChange={changeObservedEntities}
          />

          <ReadingMapPanel
            entities={visibleMapEntities}
            currentChapterId={currentChapterId}
            chapters={readingPackage.chapters}
          />

          <ReadingFactsPanel
            key={`${readingPackage.id}:${currentChapterId}`}
            facts={readingPackage.facts}
            entities={readingPackage.entities}
            currentChapterId={currentChapterId}
            currentChapter={currentChapter}
            chapters={readingPackage.chapters}
          />
        </main>

        <aside className="reader-sidebar">
          <section className="reader-sidebar-card">
            <h3><LibraryBig size={17} /> 资料包内容</h3>
            <div className="reader-package-stats">
              <span><b>{readingPackage.chapters.length}</b> 稳定章节</span>
              <span><b>{readingPackage.sources.length}</b> 已批准来源</span>
              <span><b>{readingPackage.onDemandEntities?.length || 0}</b> 按需实体</span>
              <span><b>{readingPackage.entities.length}</b> 章节实体</span>
              <span><b>{readingPackage.facts.length}</b> 正式事实</span>
            </div>
            <p>版本 {readingPackage.packageVersion}。按需实体只在读者输入命中后出现；待审候选不会进入运行时资料包。</p>
          </section>
          <section className="reader-sidebar-card">
            <h3><MapPin size={17} /> 地图资料</h3>
            <strong>
              {visibleReadingEntities(
                visibleMapEntities,
                currentChapterId,
                readingPackage.chapters,
              ).filter((entity) => entity.kind === 'place').length} 个当前可见地点
            </strong>
            <p>数量按已读章节确定性过滤；按需地点由读者确认章节解锁。</p>
          </section>
          <section className="reader-sidebar-card">
            <h3><UserRoundSearch size={17} /> 已遇到的名字</h3>
            <strong>
              {visibleObservedEntities(
                savedState?.observedEntities,
                currentChapterId,
                readingPackage.chapters,
              ).length} 个当前可见记录
            </strong>
            <p>由读者主动确认并锚定章节；不会自动获得资料库事实。</p>
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
