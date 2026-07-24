import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ClipboardPaste,
  Eye,
  EyeOff,
  Image,
  Laptop,
  LibraryBig,
  Lock,
  MapPin,
  Plus,
  ScanSearch,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRoundSearch,
  X,
} from 'lucide-react'
import { getReadingState, saveReadingState } from '../db/readingState.js'
import {
  deletePersonalReadingPackage,
  savePersonalReadingPackage,
} from '../db/personalBooks.js'
import { loadReadingPackage, loadReadingPackageCatalog } from '../data/readingPackages.js'
import { ReadingGeoMap } from './ReadingGeoMap.jsx'
import { generateId } from '../../../utils.js'
import {
  requestAppInstall,
  subscribeInstallPrompt,
} from '../../../pwaInstall.js'
import { searchReadingPlaces } from '../map/geocoding.js'
import { recognizeReadingImage } from '../ocr/localOcr.js'
import {
  READING_MODEL_STORAGE_KEYS,
  analyzeReadingExcerpt,
} from '../model/modelAdapter.js'
import {
  createPersonalReadingPackage,
  personalCatalogEntry,
} from '../domain/personalBooks.js'
import {
  READING_MAP_PROVIDER,
  READING_MAP_PROVIDERS,
  READING_MAP_STORAGE_KEYS,
  normalizeReadingMapProvider,
} from '../map/mapConfig.js'
import {
  SPOILER_GATE_ACTION,
  SPOILER_CATEGORY_LABELS,
  SPOILER_RISK,
  canRevealRisk,
  clearObservedPlaceLocation,
  confirmObservedPlaceLocation,
  OBSERVED_ENTITY_KIND,
  OBSERVED_PLACE_KIND,
  matchOnDemandEntity,
  readingPlaceRelations,
  readerConfirmedMapEntities,
  scanOnDemandEntities,
  spoilerGateAction,
  unlockedOnDemandEntities,
  upsertObservedEntity,
  updateObservedPlaceKind,
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

const OBSERVED_PLACE_KIND_LABELS = {
  [OBSERVED_PLACE_KIND.UNKNOWN]: '不确定',
  [OBSERVED_PLACE_KIND.REAL]: '现实地点',
  [OBSERVED_PLACE_KIND.FICTIONAL]: '虚构地点',
  [OBSERVED_PLACE_KIND.PROTOTYPE]: '有现实原型',
  [OBSERVED_PLACE_KIND.APPROXIMATE]: '位置模糊',
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

function PersonalBookCreator({ onCreate, onCancel }) {
  const [form, setForm] = useState({
    title: '',
    author: '',
    translators: '',
    publisher: '',
    isbn: '',
    publishedAt: '',
    originalLanguage: '',
    chapterCount: 1,
    chapterText: '',
  })
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  function change(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setStatus('')
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setStatus('')
    try {
      await onCreate(form)
    } catch (error) {
      setStatus(error?.message || '创建书籍失败')
      setSaving(false)
    }
  }

  return (
    <section className="reader-personal-book-creator">
      <div className="reader-personal-book-heading">
        <div>
          <strong>添加个人书籍</strong>
          <span>只创建书目、版本和章节；稍后仍可导入正式资料包。</span>
        </div>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="关闭添加书籍">
          <X size={15} />
        </button>
      </div>
      <form onSubmit={submit}>
        <div className="reader-personal-book-grid">
          <label>
            <span>书名 *</span>
            <input value={form.title} onChange={(event) => change('title', event.target.value)} />
          </label>
          <label>
            <span>作者 *</span>
            <input value={form.author} onChange={(event) => change('author', event.target.value)} />
          </label>
          <label>
            <span>译者</span>
            <input
              value={form.translators}
              onChange={(event) => change('translators', event.target.value)}
              placeholder="多人用顿号分隔"
            />
          </label>
          <label>
            <span>出版社 / 版本</span>
            <input value={form.publisher} onChange={(event) => change('publisher', event.target.value)} />
          </label>
          <label>
            <span>ISBN</span>
            <input value={form.isbn} onChange={(event) => change('isbn', event.target.value)} />
          </label>
          <label>
            <span>出版月份</span>
            <input
              type="month"
              value={form.publishedAt}
              onChange={(event) => change('publishedAt', event.target.value)}
            />
          </label>
          <label>
            <span>原作语言</span>
            <input
              value={form.originalLanguage}
              onChange={(event) => change('originalLanguage', event.target.value)}
              placeholder="例如 en、zh"
            />
          </label>
          <label>
            <span>章节数</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={form.chapterCount}
              onChange={(event) => change('chapterCount', event.target.value)}
            />
          </label>
        </div>
        <label className="reader-personal-chapters">
          <span>或者粘贴目录（每行一章）</span>
          <textarea
            rows={6}
            value={form.chapterText}
            onChange={(event) => change('chapterText', event.target.value)}
            placeholder={'1\n2\n3\n…\n也可以粘贴“第一章 某某”等完整标题'}
          />
          <small>粘贴目录后以非空行数为准；纯数字会自动显示为“第 N 章”。</small>
        </label>
        {status && <p className="reader-observed-status" role="alert">{status}</p>}
        <div className="reader-personal-book-actions">
          <button type="button" className="btn" onClick={onCancel}>取消</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Plus size={14} /> {saving ? '创建中…' : '创建并开始阅读'}
          </button>
        </div>
      </form>
    </section>
  )
}

function WindowsInstallCard() {
  const isWindows = navigator.userAgent.includes('Windows')
  const [installable, setInstallable] = useState(false)
  const [status, setStatus] = useState('')
  const standalone = window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => subscribeInstallPrompt(setInstallable), [])
  if (!isWindows) return null

  async function install() {
    const choice = await requestAppInstall()
    if (choice?.outcome === 'accepted') {
      setStatus('安装已开始，完成后可从开始菜单或桌面打开。')
    } else if (choice) {
      setStatus('已取消安装；以后仍可从浏览器菜单安装。')
    }
  }

  return (
    <section className="reader-windows-install">
      <Laptop size={22} />
      <div>
        <strong>{standalone ? '已作为 Windows 应用运行' : '安装到 Windows'}</strong>
        <p>
          {standalone
            ? '当前是独立窗口；数据仍只保存在这个浏览器应用中。'
            : '用 Edge 或 Chrome 安装后可从开始菜单启动，并继续使用本机书架、剪贴板和 OCR。'}
        </p>
        {!standalone && !installable && (
          <small>如果按钮尚未出现，请使用浏览器地址栏或“应用”菜单中的“安装 TangerineTools”。</small>
        )}
        {status && <small>{status}</small>}
      </div>
      {!standalone && installable && (
        <button type="button" className="btn btn-sm" onClick={install}>
          <Laptop size={14} /> 安装应用
        </button>
      )}
    </section>
  )
}

function ReadingLibrary({ catalog, onSelect, onCreate, onDelete }) {
  const [creating, setCreating] = useState(false)
  return (
    <div className="reader-tool reader-library">
      <section className="reader-library-hero">
        <span className="reader-eyebrow"><LibraryBig size={15} /> 经典文学阅读伴侣</span>
        <h2>选择一本书</h2>
        <p>每本书拥有独立的版本资料、阅读进度和已遇到名称。</p>
      </section>
      <WindowsInstallCard />
      <section className="reader-library-panel">
        <div className="reader-library-heading">
          <div>
            <h3>我的书架</h3>
            <span>{catalog.length} 本已准备</span>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => setCreating(true)}>
            <Plus size={13} /> 添加书籍
          </button>
        </div>
        {creating && (
          <PersonalBookCreator
            onCreate={onCreate}
            onCancel={() => setCreating(false)}
          />
        )}
        {catalog.length > 0 ? (
          <div className="reader-book-grid">
            {catalog.map((entry) => (
              <article className="reader-book-card-shell" key={entry.id}>
                <button
                  className="reader-book-card"
                  type="button"
                  onClick={() => onSelect(entry.id)}
                >
                  <span className="reader-book-cover"><BookOpen size={26} /></span>
                  <span className="reader-book-copy">
                    <strong>{entry.title}</strong>
                    <small>{entry.editionLabel}</small>
                    {entry.source === 'personal' && <em>个人书籍</em>}
                    <b>开始阅读</b>
                  </span>
                </button>
                {entry.source === 'personal' && (
                  <button
                    type="button"
                    className="reader-book-delete"
                    onClick={() => onDelete(entry)}
                    aria-label={`删除个人书籍“${entry.title}”`}
                  >
                    <Trash2 size={14} /> 删除
                  </button>
                )}
              </article>
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
            <span>书架、章节进度、剪贴板、截图 OCR、名称识别、地点地图、本机保存</span>
          </div>
          <div>
            <strong>暂未开放</strong>
            <span>自由剧情问答、自动人物关系、移动端原生分享、未审计事实自动入库</span>
          </div>
        </div>
      </section>
    </div>
  )
}

function ModelAnalysisPanel({
  excerpt,
  bookTitle,
  currentChapter,
  onConfirmCandidate,
}) {
  const [open, setOpen] = useState(false)
  const [endpoint, setEndpoint] = useState(
    () => window.localStorage.getItem(READING_MODEL_STORAGE_KEYS.endpoint)
      || 'https://api.openai.com/v1/chat/completions',
  )
  const [model, setModel] = useState(
    () => window.localStorage.getItem(READING_MODEL_STORAGE_KEYS.model) || '',
  )
  const [apiKey, setApiKey] = useState(
    () => window.sessionStorage.getItem(READING_MODEL_STORAGE_KEYS.apiKey) || '',
  )
  const [requestState, setRequestState] = useState('idle')
  const [message, setMessage] = useState('')
  const [candidates, setCandidates] = useState([])

  async function analyze() {
    setRequestState('working')
    setMessage('')
    setCandidates([])
    window.localStorage.setItem(READING_MODEL_STORAGE_KEYS.endpoint, endpoint.trim())
    window.localStorage.setItem(READING_MODEL_STORAGE_KEYS.model, model.trim())
    window.sessionStorage.setItem(READING_MODEL_STORAGE_KEYS.apiKey, apiKey.trim())
    try {
      const results = await analyzeReadingExcerpt({
        endpoint,
        model,
        apiKey,
        excerpt,
        bookTitle,
        chapterLabel: currentChapter?.label,
      })
      setCandidates(results)
      setRequestState('done')
      setMessage(
        results.length > 0
          ? '模型结果只是候选；请逐项核对原文后确认。'
          : '模型没有返回符合约束的名称候选。',
      )
    } catch (error) {
      setRequestState('error')
      setMessage(error?.message || '模型识别失败')
    }
  }

  async function confirm(candidate) {
    try {
      const saved = await onConfirmCandidate(candidate)
      setCandidates((current) => current.filter((item) => item !== candidate))
      setMessage(
        saved
          ? `已把“${candidate.name}”记在${currentChapter?.label || '当前章'}。`
          : `“${candidate.name}”已经记录在当前章或更早章节。`,
      )
    } catch (error) {
      setMessage(error?.message || '保存模型候选失败')
    }
  }

  return (
    <div className="reader-model-panel">
      <div className="reader-model-heading">
        <div>
          <Sparkles size={19} />
          <div>
            <strong>模型识别 · 可选外部能力</strong>
            <p>只发送当前段落，识别名称候选；不会自动写入资料库或生成剧情解释。</p>
          </div>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => setOpen((value) => !value)}>
          <Settings2 size={14} /> {open ? '收起配置' : '配置模型'}
        </button>
      </div>
      {open && (
        <div className="reader-model-config">
          <label>
            <span>兼容接口地址</span>
            <input
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              placeholder="https://…/v1/chat/completions"
            />
          </label>
          <label>
            <span>模型名称</span>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="填写服务商提供的模型 id"
            />
          </label>
          <label>
            <span>API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="只保存在当前浏览器会话"
              autoComplete="off"
            />
          </label>
          <p>
            点击识别会把当前段落、书名和当前章节标签发送到该地址。Key 只存在
            sessionStorage，关闭浏览器后失效；接口地址和模型名保存在本机。
          </p>
        </div>
      )}
      <button
        type="button"
        className="btn reader-model-run"
        onClick={analyze}
        disabled={!excerpt.trim() || requestState === 'working'}
      >
        <Sparkles size={15} />
        {requestState === 'working' ? '正在识别当前段落…' : '用模型识别名称候选'}
      </button>
      {message && <p className="reader-model-message" role="status">{message}</p>}
      {candidates.length > 0 && (
        <div className="reader-model-candidates">
          {candidates.map((candidate) => (
            <div
              className="reader-model-candidate"
              key={`${candidate.kind}:${candidate.name}`}
            >
              <div>
                <strong>{candidate.name}</strong>
                <span>
                  {OBSERVED_KIND_LABELS[candidate.kind]}
                  {candidate.kind === OBSERVED_ENTITY_KIND.PLACE
                    ? ` · ${OBSERVED_PLACE_KIND_LABELS[candidate.placeKind]}`
                    : ''}
                  {candidate.confidence !== null
                    ? ` · 模型置信度 ${Math.round(candidate.confidence * 100)}%`
                    : ''}
                </span>
                {candidate.reason && <p>{candidate.reason}</p>}
              </div>
              <button type="button" className="btn btn-sm" onClick={() => confirm(candidate)}>
                <Plus size={13} /> 核对后确认
              </button>
            </div>
          ))}
        </div>
      )}
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
  const [placeKind, setPlaceKind] = useState(OBSERVED_PLACE_KIND.UNKNOWN)
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
        placeKind,
        firstSeenChapterId: currentChapterId,
      }, chapters)
      if (next === observedEntities) {
        setStatus('这个名称已经记录在当前章或更早章节。')
        return
      }
      await onChange(next)
      setName('')
      setPlaceKind(OBSERVED_PLACE_KIND.UNKNOWN)
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

  async function removeObservedMapLocation(id) {
    setStatus('')
    try {
      await onChange(clearObservedPlaceLocation(observedEntities, id))
      setStatus('已清除个人地图位置，名称和首次遇到章节仍然保留。')
    } catch (error) {
      setStatus(error?.message || '清除地图位置失败')
    }
  }

  async function changeObservedPlaceKind(id, nextPlaceKind) {
    setStatus('')
    try {
      await onChange(updateObservedPlaceKind(observedEntities, id, nextPlaceKind))
      setStatus(
        nextPlaceKind === OBSERVED_PLACE_KIND.REAL
          ? '已标记为现实地点，可以在地图区域搜索位置。'
          : '已更新地点性质；非现实地点不会发送给公网地图搜索。',
      )
    } catch (error) {
      setStatus(error?.message || '更新地点性质失败')
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
        {kind === OBSERVED_ENTITY_KIND.PLACE && (
          <label>
            <span>地点性质</span>
            <select value={placeKind} onChange={(event) => setPlaceKind(event.target.value)}>
              {Object.entries(OBSERVED_PLACE_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        )}
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
                  {!match && entity.kind === OBSERVED_ENTITY_KIND.PLACE && (
                    <label className="reader-observed-place-kind">
                      <span>地点性质</span>
                      <select
                        value={entity.placeKind || OBSERVED_PLACE_KIND.UNKNOWN}
                        onChange={(event) => changeObservedPlaceKind(entity.id, event.target.value)}
                      >
                        {Object.entries(OBSERVED_PLACE_KIND_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {entity.mapLocation && (
                    <div className="reader-observed-match">
                      <b>个人确认的现实位置</b>
                      <span>{entity.mapLocation.label}</span>
                      <button
                        type="button"
                        className="reader-observed-unlink"
                        onClick={() => removeObservedMapLocation(entity.id)}
                      >
                        清除地图位置并重新选择
                      </button>
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

function ReadingMapPanel({
  entities,
  observedEntities,
  onDemandEntities,
  currentChapterId,
  chapters,
  onChangeObservedEntities,
}) {
  const [providerId, setProviderId] = useState(() => normalizeReadingMapProvider(
    window.localStorage.getItem(READING_MAP_STORAGE_KEYS.provider),
  ))
  const [tiandituToken, setTiandituToken] = useState(
    () => window.localStorage.getItem(READING_MAP_STORAGE_KEYS.tiandituToken) || '',
  )
  const [tokenDraft, setTokenDraft] = useState(tiandituToken)
  const [lookupTargetId, setLookupTargetId] = useState('')
  const [lookupQuery, setLookupQuery] = useState('')
  const [lookupState, setLookupState] = useState('idle')
  const [lookupResults, setLookupResults] = useState([])
  const [lookupMessage, setLookupMessage] = useState('')
  const lookupRequestRef = useRef(0)
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
  const visibleObservedPlaces = useMemo(
    () => visibleObservedEntities(observedEntities, currentChapterId, chapters)
      .filter((entity) => entity.kind === OBSERVED_ENTITY_KIND.PLACE),
    [observedEntities, currentChapterId, chapters],
  )
  const searchableObservedPlaces = useMemo(
    () => visibleObservedPlaces.filter((entity) => (
      !entity.mapLocation
      && entity.placeKind === OBSERVED_PLACE_KIND.REAL
      && !matchOnDemandEntity(onDemandEntities, entity.name, entity.kind)
    )),
    [visibleObservedPlaces, onDemandEntities],
  )
  const lookupTarget = searchableObservedPlaces.find((place) => place.id === lookupTargetId)
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

  useEffect(() => {
    setLookupResults([])
    setLookupState('idle')
    setLookupMessage('')
  }, [providerId])

  function changeProvider(nextProviderId) {
    const normalizedProvider = normalizeReadingMapProvider(nextProviderId)
    window.localStorage.setItem(READING_MAP_STORAGE_KEYS.provider, normalizedProvider)
    setProviderId(normalizedProvider)
  }

  function saveTiandituToken(event) {
    event.preventDefault()
    const token = tokenDraft.trim()
    if (token) {
      window.localStorage.setItem(READING_MAP_STORAGE_KEYS.tiandituToken, token)
    } else {
      window.localStorage.removeItem(READING_MAP_STORAGE_KEYS.tiandituToken)
    }
    setTiandituToken(token)
    setLookupResults([])
    setLookupState('idle')
    setLookupMessage(token ? '天地图 Key 已保存在当前浏览器。' : '已清除天地图 Key。')
  }

  function beginLookup(place) {
    setLookupTargetId(place.id)
    setLookupQuery(place.name)
    setLookupResults([])
    setLookupState('idle')
    setLookupMessage('')
  }

  async function submitLookup(event) {
    event.preventDefault()
    const requestId = lookupRequestRef.current + 1
    lookupRequestRef.current = requestId
    setLookupState('loading')
    setLookupMessage('')
    setLookupResults([])
    try {
      const results = await searchReadingPlaces({
        providerId,
        query: lookupQuery,
        tiandituToken,
      })
      if (lookupRequestRef.current !== requestId) return
      setLookupResults(results)
      setLookupState('ready')
      if (results.length === 0) setLookupMessage('没有找到候选；可以补充英文名、州或国家后重试。')
    } catch (error) {
      if (lookupRequestRef.current !== requestId) return
      setLookupState('error')
      setLookupMessage(error?.message || '地图搜索失败')
    }
  }

  async function confirmLookupResult(result) {
    if (!lookupTarget) return
    setLookupMessage('')
    try {
      const next = confirmObservedPlaceLocation(
        observedEntities,
        lookupTarget.id,
        result,
      )
      await onChangeObservedEntities(next)
      setLookupTargetId('')
      setLookupQuery('')
      setLookupResults([])
      setLookupState('idle')
      setLookupMessage(`已把“${lookupTarget.name}”作为个人确认的现实地点加入地图。`)
    } catch (error) {
      setLookupMessage(error?.message || '保存地图位置失败')
    }
  }

  return (
    <section className="reader-panel">
      <div className="reader-panel-heading">
        <div>
          <span className="reader-step">04</span>
          <h3>探索已读地点</h3>
        </div>
        <span className="reader-system-chip"><ShieldCheck size={13} /> 系统规则过滤</span>
      </div>
      <div className="reader-map-provider-panel">
        <label>
          地图网络
          <select value={providerId} onChange={(event) => changeProvider(event.target.value)}>
            {Object.values(READING_MAP_PROVIDERS).map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.label}</option>
            ))}
          </select>
        </label>
        <span>{READING_MAP_PROVIDERS[providerId].description}</span>
        {providerId === READING_MAP_PROVIDER.DOMESTIC && (
          <form onSubmit={saveTiandituToken}>
            <input
              aria-label="天地图浏览器端 Key"
              autoComplete="off"
              placeholder="输入天地图浏览器端 Key"
              type="password"
              value={tokenDraft}
              onChange={(event) => setTokenDraft(event.target.value)}
            />
            <button type="submit">保存并启用</button>
          </form>
        )}
      </div>
      <div className="reader-place-lookup">
        <div className="reader-place-lookup-heading">
          <div>
            <strong>资料包外地点</strong>
            <span>只搜索你已经记录、但资料包尚未收录的地点。</span>
          </div>
          <small>点击搜索后，搜索词会发送给所选地图服务。</small>
        </div>
        {searchableObservedPlaces.length > 0 ? (
          <div className="reader-place-lookup-targets">
            {searchableObservedPlaces.map((place) => (
              <button
                className={lookupTargetId === place.id ? 'active' : ''}
                key={place.id}
                type="button"
                onClick={() => beginLookup(place)}
              >
                <MapPin size={13} /> 为“{place.name}”查找现实位置
              </button>
            ))}
          </div>
        ) : (
          <p>只有明确标记为“现实地点”的资料包外名称才会出现在这里；虚构或不确定地点不会发送给公网地图。</p>
        )}
        {lookupTarget && (
          <form className="reader-place-lookup-form" onSubmit={submitLookup}>
            <label>
              <span>地图搜索词</span>
              <input
                value={lookupQuery}
                onChange={(event) => setLookupQuery(event.target.value)}
                maxLength={120}
                placeholder="可补充英文名、州或国家"
              />
            </label>
            <button type="submit" className="btn btn-sm" disabled={!lookupQuery.trim() || lookupState === 'loading'}>
              <ScanSearch size={13} /> {lookupState === 'loading' ? '搜索中…' : '搜索公网地图'}
            </button>
          </form>
        )}
        {lookupResults.length > 0 && (
          <div className="reader-place-lookup-results">
            {lookupResults.map((result) => (
              <article key={result.id}>
                <div>
                  <strong>{result.label}</strong>
                  <span>
                    {result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}
                    {result.category && ` · ${result.category}`}
                    {result.geometry && result.geometry.type !== 'Point'
                      ? ` · ${result.geometry.type}`
                      : ''}
                  </span>
                </div>
                <button type="button" onClick={() => confirmLookupResult(result)}>
                  确认“{lookupTarget?.name}”是这个现实地点
                </button>
              </article>
            ))}
            <small>不要为虚构地点选择“看起来相近”的现实坐标；不确定时保持未定位。</small>
          </div>
        )}
        {lookupMessage && <p className="reader-place-lookup-message" role="status">{lookupMessage}</p>}
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
              providerId={providerId}
              tiandituToken={tiandituToken}
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
              {selectedPlace.accessMode === 'reader-confirmed-geocoder' && (
                <p className="reader-place-unlock-note">
                  这是你从公网地图候选中确认的现代现实位置，不是正式书籍资料。
                </p>
              )}
              {selectedPlace.geocodingProviderId && (
                <p>
                  位置候选来源：
                  {selectedPlace.geocodingProviderId === READING_MAP_PROVIDER.DOMESTIC
                    ? '天地图'
                    : 'OpenStreetMap Nominatim'}
                </p>
              )}
              {selectedPlace.parentLabel && <p>地理层级：{selectedPlace.parentLabel}</p>}
              {selectedPlace.geometry ? (
                <p>
                  {selectedPlace.geometry.type === 'area'
                    ? '区域中心约 '
                    : selectedPlace.geometry.type === 'geojson'
                      ? `${selectedPlace.geometry.geojson?.type || '路径'}代表位置约 `
                      : ''}
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
              <small>
                {selectedPlace.accessMode === 'reader-confirmed-geocoder'
                  ? '个人确认位置只用于当前阅读地图，不会写回正式资料包。'
                  : '仅展示资料包中已审计的空间字段，不生成剧情解释。'}
              </small>
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
  const [inputStatus, setInputStatus] = useState('')
  const [ocrState, setOcrState] = useState('idle')
  const [ocrProgress, setOcrProgress] = useState(0)

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
    return [
      edition.publisher,
      edition.publishedAt === '未知' ? null : `${edition.publishedAt.replace('-', '年')}月`,
      edition.isbn.startsWith('personal-') ? null : `ISBN ${edition.isbn}`,
    ].filter(Boolean).join(' · ')
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
  const personalMapEntities = useMemo(
    () => readerConfirmedMapEntities(
      observedEntities,
      currentChapterId,
      readingPackage?.chapters,
    ),
    [observedEntities, currentChapterId, readingPackage?.chapters],
  )
  const visibleMapEntities = useMemo(
    () => [...(readingPackage?.entities || []), ...unlockedEntities, ...personalMapEntities],
    [readingPackage?.entities, unlockedEntities, personalMapEntities],
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

  async function createPersonalBook(form) {
    const pkg = createPersonalReadingPackage({
      ...form,
      packageId: generateId('reader-package-personal'),
      bookId: generateId('reader-book-personal'),
      editionId: generateId('reader-edition-personal'),
    })
    await savePersonalReadingPackage(pkg)
    const entry = personalCatalogEntry(pkg)
    setCatalog((current) => [
      ...(current || []).filter((item) => item.id !== entry.id),
      entry,
    ])
    selectBook(pkg.id)
  }

  async function deletePersonalBook(entry) {
    const confirmed = window.confirm(
      `删除个人书籍“${entry.title}”？这会同时删除它在所有阅读场景中的进度、已遇到名称和个人地图位置，且无法撤销。`,
    )
    if (!confirmed) return
    await deletePersonalReadingPackage(entry.id)
    setCatalog((current) => (current || []).filter((item) => item.id !== entry.id))
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
    setInputStatus('')
  }

  async function pasteFromClipboard() {
    setInputStatus('')
    if (!navigator.clipboard?.readText) {
      setInputStatus('当前浏览器不支持直接读取剪贴板，请使用 Ctrl+V。')
      return
    }
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) {
        setInputStatus('剪贴板里没有文字。')
        return
      }
      changeExcerpt(text)
      setInputStatus('已从 Windows 剪贴板放入当前段落；文字不会自动保存。')
    } catch {
      setInputStatus('浏览器没有获得剪贴板权限，请点击文本框后使用 Ctrl+V。')
    }
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

  async function confirmModelCandidate(candidate) {
    const next = upsertObservedEntity(observedEntities, {
      id: generateId('observed'),
      name: candidate.name,
      kind: candidate.kind,
      placeKind: candidate.placeKind,
      firstSeenChapterId: currentChapterId,
    }, readingPackage.chapters)
    if (next === observedEntities) return false
    await changeObservedEntities(next)
    return true
  }

  function chooseImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (imageInput?.url) URL.revokeObjectURL(imageInput.url)
    setImageInput({ file, name: file.name, url: URL.createObjectURL(file) })
    setOcrState('idle')
    setOcrProgress(0)
    setInputStatus('')
    event.target.value = ''
  }

  function clearImage() {
    if (imageInput?.url) URL.revokeObjectURL(imageInput.url)
    setImageInput(null)
    setOcrState('idle')
    setOcrProgress(0)
  }

  async function runLocalOcr() {
    if (!imageInput?.file || ocrState === 'working') return
    setOcrState('working')
    setOcrProgress(0)
    setInputStatus('正在本机初始化 OCR…')
    try {
      const text = await recognizeReadingImage(imageInput.file, (progress) => {
        if (Number.isFinite(progress?.progress)) {
          setOcrProgress(Math.round(progress.progress * 100))
        }
        if (progress?.status === 'recognizing text') {
          setInputStatus('正在本机识别截图文字…')
        }
      })
      if (!text) {
        setOcrState('empty')
        setInputStatus('OCR 没有识别出文字，可以换一张更清晰的截图。')
        return
      }
      changeExcerpt(text)
      setOcrState('done')
      setInputStatus('OCR 文字已放入当前段落，请先核对再扫描或调用模型。')
    } catch (error) {
      setOcrState('error')
      setInputStatus(`本机 OCR 失败：${error?.message || '无法初始化识别引擎'}`)
    }
  }

  if (loadError) return <ReaderError message={loadError} />
  if (!catalog) return <LoadingPanel message="正在加载阅读书架…" />
  if (!selectedPackageId) {
    return (
      <ReadingLibrary
        catalog={catalog}
        onSelect={selectBook}
        onCreate={createPersonalBook}
        onDelete={deletePersonalBook}
      />
    )
  }
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
          <p>
            {readingPackage.book.author}
            {readingPackage.edition.translators.length > 0
              ? ` · ${readingPackage.edition.translators.join('、')} 译`
              : ''}
          </p>
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
              <button type="button" className="btn" onClick={pasteFromClipboard}>
                <ClipboardPaste size={15} /> 从剪贴板粘贴
              </button>
              <button type="button" className="btn" onClick={scanExcerpt} disabled={!excerpt.trim()}>
                <ScanSearch size={15} /> 本机扫描已知名称
              </button>
              <span>只查找段落中实际出现的资料包名称，不会显示候选清单。</span>
            </div>
            {inputStatus && <p className="reader-input-status" role="status">{inputStatus}</p>}
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
                  <span>截图和 OCR 都在当前设备处理；识别文字不会自动保存。</span>
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
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={runLocalOcr}
                    disabled={ocrState === 'working'}
                  >
                    <ScanSearch size={13} />
                    {ocrState === 'working'
                      ? `本机识别中 ${ocrProgress}%`
                      : '提取截图文字'}
                  </button>
                  <button type="button" className="icon-btn" onClick={clearImage} aria-label="移除截图">
                    <X size={15} />
                  </button>
                </div>
              </div>
            )}

            <ModelAnalysisPanel
              excerpt={excerpt}
              bookTitle={readingPackage.book.title}
              currentChapter={currentChapter}
              onConfirmCandidate={confirmModelCandidate}
            />
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
            observedEntities={observedEntities}
            onDemandEntities={readingPackage.onDemandEntities || []}
            currentChapterId={currentChapterId}
            chapters={readingPackage.chapters}
            onChangeObservedEntities={changeObservedEntities}
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
