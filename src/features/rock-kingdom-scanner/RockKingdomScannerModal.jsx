import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Camera, Check, FileImage, ScanLine, Settings2, Sparkles, Trash2, Video } from 'lucide-react'
import { createRow, db } from '../../db.js'
import { FieldInput } from '../../components/catalog.jsx'
import { FormRow, Modal } from '../../components/common.jsx'
import { RockKingdomStatFormulaGuide } from '../../components/RockKingdomStatFormulaGuide.jsx'
import { recognizeNumericImageText, recognizeStructuredImageText } from '../ocr/localOcr.js'
import {
  captureVideoFrame,
  captureVideoChangeSignature,
  captureVideoSignature,
  cropImageSource,
  loadImageSource,
  prepareScannerTextCrop,
  waitForVideoSeek,
} from './frameCapture.js'
import {
  ROCK_SCANNER_CROP_PROFILE,
  ROCK_SCANNER_CHANGE_REGIONS,
  ROCK_SCANNER_DEVICE_PROFILE,
  ROCK_SCANNER_IDENTITY_CROP_PROFILE,
  ROCK_SCANNER_STABILITY_REGION,
  bestScanMatch,
  catalogNameCandidates,
  constrainScannerFormulaInputs,
  findScannerDuplicateCandidates,
  isScannerFrameReady,
  parseScannerLevel,
  rankScanCandidates,
  recognizeGenderColor,
  recognizeScannerStatTone,
  recognizeScannerStarCount,
  resolveScannerReference,
  scannerAnchorQuality,
  scannerCharacterWhitelist,
  scannerFrameSelectionAfterAction,
  scannerOptionCandidates,
  selectScannerPanelStat,
  selectScannerLevel,
  selectStableScannerSamples,
  valuesWithAppearance,
} from '../../domain/rockKingdomScanner.js'
import { parseNatureOption } from '../../domain/nature.js'
import { ModelSettingsModal } from '../model/ModelSettingsModal.jsx'
import { MODEL_CONFIG_SCOPE, modelConfigIsComplete } from '../model/modelConfig.js'
import { useModelConfig } from '../model/useModelConfig.js'
import { correctRockScannerFields } from '../rock-kingdom-model/rockKingdomModel.js'
import { recognizeRockAppearance } from './appearanceRecognition.js'
import { recognizeRockPartnerMark } from './partnerMarkRecognition.js'
import { recognizeRockTextLabel } from './textLabelRecognition.js'

function frameId() {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? seconds : 0
  const minutes = Math.floor(safe / 60)
  const remainder = Math.floor(safe % 60)
  return `${minutes}:${String(remainder).padStart(2, '0')}`
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

function scannerCandidateSets(fields) {
  return {
    nature: scannerOptionCandidates(fieldByKey(fields, 'nature')),
    bloodline: scannerOptionCandidates(fieldByKey(fields, 'bloodline')),
    specialty: scannerOptionCandidates(fieldByKey(fields, 'specialty')),
  }
}

const SCANNER_MATCH_OPTIONS = {
  nature: { minimumScore: 0.7, minimumGap: 0.12 },
  bloodline: { minimumScore: 0.56, minimumGap: 0.06 },
  specialty: { minimumScore: 0.56, minimumGap: 0.06 },
}

const SCANNER_DUPLICATE_FIELD_LABELS = {
  appearance: '外观',
  nature: '性格',
  gender: '性别',
  specialty: '特长',
}

function scannerFieldValueLabel(fields, key, value) {
  const field = fieldByKey(fields, key)
  const option = field?.options?.find((item) => item.value === value)
  return option?.label || String(value || '未记录')
}

function bestVariantText(rawTexts, candidates) {
  return [...new Set(rawTexts.filter(Boolean))]
    .map((rawText) => ({
      rawText,
      score: rankScanCandidates(rawText, candidates)[0]?.score || 0,
    }))
    .sort((left, right) => right.score - left.score)[0]?.rawText
    || rawTexts.find(Boolean)
    || ''
}

function bestReferenceText(rawTexts, candidates) {
  const firstText = rawTexts.find(Boolean) || ''
  const firstScore = rankScanCandidates(firstText, candidates)[0]?.score || 0
  if (firstScore >= 0.62 || firstScore < 0.42) return firstText
  const retry = rawTexts.slice(1)
    .map((rawText) => ({
      rawText,
      match: bestScanMatch(rawText, candidates, { minimumScore: 0.82, minimumGap: 0.08 }),
    }))
    .filter((result) => result.match)
    .sort((left, right) => right.match.score - left.match.score)[0]
  return retry?.rawText || firstText
}

function bestVariantMatch(rawTexts, candidates, options) {
  return rawTexts
    .map((rawText) => ({ rawText, match: bestScanMatch(rawText, candidates, options) }))
    .filter((result) => result.match)
    .sort((left, right) => right.match.score - left.match.score)[0] || null
}

function recognizedPatch(rawVariants, fields) {
  const patch = {}
  const confidence = {}
  const raw = {}
  const matchers = scannerCandidateSets(fields)
  for (const [key, candidates] of Object.entries(matchers)) {
    const texts = [...new Set((rawVariants[key] || []).filter(Boolean))]
    const result = bestVariantMatch(texts, candidates, SCANNER_MATCH_OPTIONS[key])
    raw[key] = result?.rawText || texts[0] || ''
    if (!result) continue
    patch[key] = result.match.value
    confidence[key] = result.match.score
  }
  return { patch, confidence, raw }
}

function traitCandidates(nameCandidates) {
  return [...new Map(nameCandidates
    .filter((candidate) => candidate.traitName)
    .map((candidate) => [
      candidate.traitName,
      { value: candidate.traitName, label: candidate.traitName },
    ])).values()]
}

function identityEvidenceLabel(identity) {
  if (!identity) return ''
  const sourceLabels = {
    name: '游戏名称',
    'name+stats': '同名候选 + 六维形状',
    'name+formula': '同名候选 + 等级/星级公式',
    trait: '特性',
    'trait+stats': '特性 + 六维形状',
    'trait+formula': '特性 + 等级/星级公式',
    ambiguous: '同名候选仍无法区分',
    unresolved: '昵称/名称无法关联资料库',
  }
  return sourceLabels[identity.source] || identity.source
}

const SCANNER_STAT_LABELS = {
  hp: '生命',
  patk: '物攻',
  matk: '魔攻',
  pdef: '物防',
  mdef: '魔防',
  spd: '速度',
}

const SCANNER_STAT_TONE_LABELS = {
  white: '白',
  yellow: '黄',
  unknown: '颜色不明',
}

function formulaFailureLabel(identity) {
  const diagnostics = identity?.diagnostics
  const labels = {
    'missing-level': '等级未识别，公式未启动。',
    'missing-stars': '星级未识别，公式未启动。',
    'missing-nature': '性格未识别；手动选择性格后会自动重新判断形态。',
    'insufficient-stats': '可用六维不足：需要至少 5 项数字、至少 3 项可靠白色数值，或 4 项数字且其中至少 2 项为可靠白色。',
    'formula-unavailable': '当前输入无法生成合法培养面板。',
    'best-error-too-high': `最佳候选误差超过 ${diagnostics?.maximumFormulaRmse ?? 2.5}。`,
    'candidate-gap-too-small': `前两名误差差距低于 ${diagnostics?.minimumFormulaRmseGap ?? 1.5}。`,
    resolved: '公式误差和候选差距均达到自动采用门槛。',
  }
  return labels[diagnostics?.failure] || '当前没有形态公式诊断。'
}

function ScannerFormulaDiagnostics({ identity }) {
  if (!identity?.diagnostics) return null
  const diagnostics = identity.diagnostics
  const statsText = Object.entries(SCANNER_STAT_LABELS).map(([key, label]) => {
    const value = Number(identity.panelStats?.[key]) || 0
    const tone = identity.statTones?.[key]?.tone || 'unknown'
    return `${label} ${value || '未识别'}（${SCANNER_STAT_TONE_LABELS[tone]}）`
  }).join(' / ')
  const uncertainOcr = Object.entries(SCANNER_STAT_LABELS).flatMap(([key, label]) => {
    const result = identity.panelStatOcr?.[key]
    if (
      !result
      || (
        result.value
        && result.candidates.length <= 1
        && !result.formulaRepaired
      )
    ) return []
    const candidates = result.candidates.length > 0 ? result.candidates.join('、') : '均为空'
    const note = result.formulaRepaired
      ? `（公式纠正为 ${result.value}）`
      : result.rejectedByFormula
        ? '（超出合法面板）'
        : result.ambiguous
          ? '（结果冲突）'
          : ''
    return [`${label}：${candidates}${note}`]
  })
  const candidates = (identity.candidates || []).slice(0, 4)
  return (
    <details
      className="scanner-formula-diagnostics"
      onClick={(event) => event.stopPropagation()}
    >
      <summary>
        形态识别诊断 · {identity.value ? '已得到候选' : formulaFailureLabel(identity)}
      </summary>
      <div className="scanner-formula-diagnostics-body">
        <span>
          输入：{identity.level ? `${identity.level}级` : '等级未识别'}
          {' / '}{identity.stars == null ? '星级未识别' : `${identity.stars}星`}
          {' / '}{identity.nature?.name || '性格未识别'}
        </span>
        <span>OCR 六维：{statsText}</span>
        {uncertainOcr.length > 0 && <span>数字重试：{uncertainOcr.join(' / ')}</span>}
        <span>
          口径：{diagnostics.mode === 'white-first'
            ? `优先使用白色未加成项（${diagnostics.whiteStatKeys.map((key) => SCANNER_STAT_LABELS[key]).join('、')}）`
            : diagnostics.mode === 'mixed-evidence'
              ? `使用四项以上数值；白色项固定未加成（${diagnostics.whiteStatKeys.map((key) => SCANNER_STAT_LABELS[key]).join('、')}），其余枚举天分`
              : '使用全部已识别数值并枚举天分'}
        </span>
        {identity.levelOcr?.rawVariants?.length > 0 && (
          <span>
            等级重试：{identity.levelOcr.rawVariants.filter(Boolean).join(' / ') || '均为空'}
            {identity.levelOcr.ambiguous ? '（结果冲突）' : ''}
            {identity.levelOcr.formulaInferred ? `（联合公式推断为 ${identity.level} 级）` : ''}
          </span>
        )}
        {diagnostics.constraintAttempts?.length > 0 && (
          <span>
            联合约束：{diagnostics.constraintAttempts.map((attempt) => (
              `${attempt.level}级·${attempt.label}，${attempt.evidenceCount}项证据，误差 ${attempt.rmse.toFixed(2)}`
            )).join(' / ')}
            {diagnostics.constraintAttemptGap != null
              ? `；前两组差距 ${diagnostics.constraintAttemptGap.toFixed(2)}`
              : ''}
          </span>
        )}
        {candidates.length > 0 && (
          <span>
            候选误差：{candidates.map((candidate) => (
              `${candidate.label} ${candidate.cultivationFit
                ? candidate.cultivationFit.rmse.toFixed(2)
                : '未计算'}`
            )).join(' / ')}
          </span>
        )}
        {diagnostics.rmseGap != null && <span>前两名差距：{diagnostics.rmseGap.toFixed(2)}</span>}
        <span>
          自动门槛：最佳误差不超过 {diagnostics.maximumFormulaRmse}
          {' / '}前两名差距至少 {diagnostics.minimumFormulaRmseGap}
        </span>
        <em>{formulaFailureLabel(identity)}</em>
      </div>
    </details>
  )
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
  const ownedRows = useLiveQuery(
    () => db.catalogRows.where('tableId').equals(table.id).toArray(),
    [table.id],
  )
  const nameCandidates = useMemo(
    () => catalogNameCandidates(catalogRows || [], catalogFields || []),
    [catalogRows, catalogFields],
  )
  const [videoUrl, setVideoUrl] = useState('')
  const [videoName, setVideoName] = useState('')
  const [videoDimensions, setVideoDimensions] = useState(null)
  const [extractionSummary, setExtractionSummary] = useState(null)
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
  const selectedDuplicateCandidates = selected
    ? findScannerDuplicateCandidates(selected.values, ownedRows || [])
    : []
  const selectedHasBlockingDuplicate = selectedDuplicateCandidates.some((item) => item.blocking)

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
      values: { ...ownedDefaults, appearance: 'none', partnerMark: 'none' },
      raw: {},
      confidence: {},
      reviewed: false,
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
        values: { ...ownedDefaults, appearance: 'none', partnerMark: 'none' },
        raw: {},
        confidence: {},
        reviewed: false,
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
    setExtractionSummary(null)
    const items = []
    try {
      for (let index = 0; index < count; index += 1) {
        const time = Math.min(video.duration - 0.05, index * intervalSeconds)
        setProgress(`正在提取 ${index + 1} / ${count}`)
        await waitForVideoSeek(video, time)
        const captured = await captureVideoFrame(video)
        items.push({
          id: frameId(),
          url: createLocalUrl(captured.blob),
          sourceName: videoName,
          time,
          width: captured.width,
          height: captured.height,
          values: { ...ownedDefaults, appearance: 'none', partnerMark: 'none' },
          raw: {},
          confidence: {},
          reviewed: false,
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

  async function extractStableFrames() {
    const video = videoRef.current
    if (!video?.duration) {
      setError('请先选择并加载一个视频。')
      return
    }
    if (
      video.videoWidth !== ROCK_SCANNER_DEVICE_PROFILE.width
      || video.videoHeight !== ROCK_SCANNER_DEVICE_PROFILE.height
    ) {
      setError(`当前仅支持${ROCK_SCANNER_DEVICE_PROFILE.label}录屏；这个视频是 ${video.videoWidth}×${video.videoHeight}。`)
      return
    }
    const stepSeconds = Math.max(0.3, video.duration / 3600)
    const sampleCount = Math.max(1, Math.ceil(video.duration / stepSeconds))
    setBusy('extract-smart')
    setError('')
    setExtractionSummary(null)
    const samples = []
    const items = []
    const startedAt = performance.now()
    try {
      for (let index = 0; index < sampleCount; index += 1) {
        const time = Math.min(video.duration - 0.05, index * stepSeconds)
        if (index === 0 || index % 10 === 0) {
          setProgress(`正在可靠模式检测稳定画面 ${index + 1} / ${sampleCount}`)
        }
        await waitForVideoSeek(video, time)
        const signature = captureVideoSignature(video, ROCK_SCANNER_STABILITY_REGION)
        samples.push({
          time,
          signature,
          changeSignature: captureVideoChangeSignature(video, ROCK_SCANNER_CHANGE_REGIONS),
          anchorQuality: scannerAnchorQuality(signature),
        })
      }
      const stableSamples = selectStableScannerSamples(samples)
      for (let index = 0; index < stableSamples.length; index += 1) {
        const sample = stableSamples[index]
        setProgress(`正在保存稳定画面 ${index + 1} / ${stableSamples.length}`)
        await waitForVideoSeek(video, sample.time)
        const captured = await captureVideoFrame(video)
        items.push({
          id: frameId(),
          url: createLocalUrl(captured.blob),
          sourceName: videoName,
          time: sample.time,
          width: captured.width,
          height: captured.height,
          values: { ...ownedDefaults, appearance: 'none', partnerMark: 'none' },
          raw: {},
          confidence: {},
          reviewed: false,
          status: '稳定画面，待识别',
        })
      }
      addFrames(items)
      setExtractionSummary({
        checked: samples.length,
        kept: items.length,
        stepSeconds,
        elapsedSeconds: (performance.now() - startedAt) / 1000,
        mode: '可靠跳转',
      })
      if (items.length === 0) {
        setError('没有找到连续稳定终态。请确认每只精灵在切换完成后稳定停留约 1 秒；也可以先用备用入口按固定间隔抽帧。')
      } else {
        setProgress(`智能提取完成：检测 ${samples.length} 个时间点，保留 ${items.length} 张稳定且不重复的画面。`)
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

  function recheckFrameWithFormula(frame, natureValue) {
    if (!frame.identity || frame.identity.stars == null || !natureValue) return frame
    const natureOption = fieldByKey(fields, 'nature')?.options
      ?.find((option) => option.value === natureValue)
    const nature = parseNatureOption(natureOption || {})
    const constraintCandidates = frame.identity.candidates?.length > 1
      ? frame.identity.candidates
      : nameCandidates
    const constrained = constrainScannerFormulaInputs({
      rawName: frame.raw?.ref,
      rawTrait: frame.identity.rawTrait,
      panelStatOcr: frame.identity.panelStatOcr,
      levelOcr: frame.identity.levelOcr,
      stars: frame.identity.stars,
      nature,
      statTones: frame.identity.statTones,
      candidates: constraintCandidates,
    })
    const level = constrained.applied ? constrained.level : frame.identity.level
    const panelStats = constrained.applied
      ? constrained.panelStats
      : frame.identity.panelStats
    const panelStatOcr = constrained.applied
      ? constrained.panelStatOcr
      : frame.identity.panelStatOcr
    const levelOcr = constrained.applied
      ? {
          ...frame.identity.levelOcr,
          value: level,
          formulaInferred: constrained.levelInferred,
        }
      : frame.identity.levelOcr
    const identity = constrained.applied
      ? constrained.identity
      : resolveScannerReference({
          rawName: frame.raw?.ref,
          rawTrait: frame.identity.rawTrait,
          panelStats,
          level,
          stars: frame.identity.stars,
          nature,
          statTones: frame.identity.statTones,
          candidates: nameCandidates,
        })
    return {
      ...frame,
      values: identity.value
        ? { ...frame.values, nature: natureValue, ref: identity.value }
        : { ...frame.values, nature: natureValue },
      confidence: identity.value
        ? { ...frame.confidence, nature: 1, ref: identity.score }
        : { ...frame.confidence, nature: 1 },
      identity: {
        ...identity,
        rawTrait: frame.identity.rawTrait,
        rawLevel: frame.identity.rawLevel,
        levelOcr,
        level,
        stars: frame.identity.stars,
        nature,
        panelStats,
        panelStatOcr,
        statTones: frame.identity.statTones,
      },
      duplicateDecision: '',
      reviewed: false,
      status: identity.value ? '性格已修正并自动重判形态，待复核' : '性格已修正，公式仍无法区分形态',
    }
  }

  function patchFrameValue(id, key, value) {
    setFrames((current) => current.map((frame) => {
      if (frame.id !== id) return frame
      const nextFrame = {
          ...frame,
          values: { ...frame.values, [key]: value },
          confidence: { ...frame.confidence, [key]: 1 },
          duplicateDecision: '',
          reviewed: false,
          status: '待确认',
        }
      return key === 'nature'
        ? recheckFrameWithFormula(nextFrame, value)
        : nextFrame
    }))
  }

  async function recognizeFrame(frame) {
    patchFrame(frame.id, { status: '识别中' })
    const image = await loadImageSource(frame.url)
    const rawVariants = {}
    const candidateSets = {
      ref: nameCandidates,
      ...scannerCandidateSets(fields),
    }
    for (const key of ['name', 'bloodline', 'nature', 'specialty']) {
      const fieldKey = key === 'name' ? 'ref' : key
      setProgress(`正在识别 ${frame.sourceName}${frame.time == null ? '' : ` ${formatTime(frame.time)}`} · ${ROCK_SCANNER_CROP_PROFILE[key].label}`)
      const crop = cropImageSource(image, ROCK_SCANNER_CROP_PROFILE[key])
      const baseOptions = {
        pageSegmentationMode: key === 'name' ? '8' : '7',
      }
      const firstText = await recognizeStructuredImageText(
        crop,
        undefined,
        baseOptions,
      )
      rawVariants[fieldKey] = [firstText]
      const firstMatch = bestScanMatch(
        firstText,
        candidateSets[fieldKey],
        SCANNER_MATCH_OPTIONS[fieldKey] || { minimumScore: 0.62, minimumGap: 0.08 },
      )
      if (!firstMatch || firstMatch.score < 0.78) {
        const preparedCrop = prepareScannerTextCrop(crop)
        rawVariants[fieldKey].push(await recognizeStructuredImageText(
          preparedCrop,
          undefined,
          {
            ...baseOptions,
            characterWhitelist: scannerCharacterWhitelist(candidateSets[fieldKey]),
          },
        ))
        if (key === 'nature') {
          rawVariants[fieldKey].push(await recognizeStructuredImageText(
            preparedCrop,
            undefined,
            {
              pageSegmentationMode: '8',
              characterWhitelist: scannerCharacterWhitelist(candidateSets[fieldKey]),
            },
          ))
        }
      }
    }
    const matched = recognizedPatch(rawVariants, fields)
    for (const key of ['nature', 'specialty']) {
      const templateMatch = await recognizeRockTextLabel(image, key)
      if (!templateMatch) continue
      matched.patch[key] = templateMatch.value
      matched.confidence[key] = templateMatch.score
    }
    matched.raw.ref = bestReferenceText(rawVariants.ref, nameCandidates)
    let identity = resolveScannerReference({
      rawName: matched.raw.ref,
      candidates: nameCandidates,
    })
    if (!identity.value) {
      const availableTraits = traitCandidates(nameCandidates)
      setProgress(`正在识别 ${frame.sourceName}${frame.time == null ? '' : ` ${formatTime(frame.time)}`} · 特性和六维形态`)
      const traitCrop = cropImageSource(image, ROCK_SCANNER_IDENTITY_CROP_PROFILE.trait)
      const traitRaw = await recognizeStructuredImageText(
        traitCrop,
        undefined,
        { pageSegmentationMode: '7' },
      )
      const traitVariants = [traitRaw]
      const traitMatch = bestScanMatch(
        traitRaw,
        availableTraits,
        { minimumScore: 0.62, minimumGap: 0.08 },
      )
      if (!traitMatch || traitMatch.score < 0.78) {
        traitVariants.push(await recognizeStructuredImageText(
          prepareScannerTextCrop(traitCrop),
          undefined,
          {
            pageSegmentationMode: '7',
            characterWhitelist: scannerCharacterWhitelist(availableTraits),
          },
        ))
      }
      const rawTrait = bestVariantText(traitVariants, availableTraits)
      const levelCrop = cropImageSource(image, ROCK_SCANNER_IDENTITY_CROP_PROFILE.level)
      const levelVariants = []
      levelVariants.push(await recognizeStructuredImageText(
        levelCrop,
        undefined,
        { pageSegmentationMode: '7', characterWhitelist: '0123456789/' },
      ))
      levelVariants.push(await recognizeNumericImageText(levelCrop))
      let levelOcr = selectScannerLevel(levelVariants)
      if (!levelOcr.value) {
        const preparedLevelCrop = prepareScannerTextCrop(levelCrop, { width: 512, height: 160 })
        levelVariants.push(await recognizeNumericImageText(
          preparedLevelCrop,
          undefined,
          { pageSegmentationMode: '7' },
        ))
        levelVariants.push(await recognizeNumericImageText(
          preparedLevelCrop,
          undefined,
          { pageSegmentationMode: '8' },
        ))
        levelOcr = selectScannerLevel(levelVariants)
      }
      levelOcr = { ...levelOcr, rawVariants: levelVariants }
      const rawLevel = levelVariants.find((value) => parseScannerLevel(value) === levelOcr.value)
        || levelVariants.find(Boolean)
        || ''
      let level = levelOcr.value
      const starsCrop = cropImageSource(image, ROCK_SCANNER_IDENTITY_CROP_PROFILE.stars, 1)
      const stars = recognizeScannerStarCount(
        starsCrop.getContext('2d', { willReadFrequently: true })
          .getImageData(0, 0, starsCrop.width, starsCrop.height),
      )
      const panelStats = {}
      const panelStatOcr = {}
      const statTones = {}
      for (const statKey of ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']) {
        const toneCrop = cropImageSource(image, ROCK_SCANNER_IDENTITY_CROP_PROFILE[statKey])
        statTones[statKey] = recognizeScannerStatTone(
          toneCrop.getContext('2d', { willReadFrequently: true })
            .getImageData(0, 0, toneCrop.width, toneCrop.height),
        )
        const statCrop = toneCrop
        const rawVariants = []
        rawVariants.push(await recognizeStructuredImageText(
          statCrop,
          undefined,
          { pageSegmentationMode: '7', characterWhitelist: '0123456789' },
        ))
        rawVariants.push(await recognizeNumericImageText(statCrop))
        const rawResult = selectScannerPanelStat(rawVariants, { trustedVariantCount: 2 })
        if (!rawResult.value) {
          const preparedStatCrop = prepareScannerTextCrop(statCrop, { width: 512, height: 160 })
          rawVariants.push(await recognizeNumericImageText(
            preparedStatCrop,
            undefined,
            { pageSegmentationMode: '7' },
          ))
          rawVariants.push(await recognizeNumericImageText(
            preparedStatCrop,
            undefined,
            { pageSegmentationMode: '8' },
          ))
        }
        panelStatOcr[statKey] = {
          ...selectScannerPanelStat(rawVariants, { trustedVariantCount: 2 }),
          rawVariants,
        }
        panelStats[statKey] = panelStatOcr[statKey].value
      }
      const natureOption = fieldByKey(fields, 'nature')?.options
        ?.find((option) => option.value === matched.patch.nature)
      const nature = parseNatureOption(natureOption || {})
      identity = resolveScannerReference({
        rawName: matched.raw.ref,
        rawTrait,
        panelStats,
        level,
        stars,
        nature,
        statTones,
        candidates: nameCandidates,
      })
      if (identity.candidates?.length > 1) {
        const constrained = constrainScannerFormulaInputs({
          rawName: matched.raw.ref,
          rawTrait,
          panelStatOcr,
          levelOcr,
          stars,
          nature,
          statTones,
          candidates: identity.candidates,
        })
        if (constrained.applied) {
          level = constrained.level
          levelOcr = {
            ...levelOcr,
            value: level,
            formulaInferred: constrained.levelInferred,
          }
          Object.assign(panelStats, constrained.panelStats)
          Object.assign(panelStatOcr, constrained.panelStatOcr)
          identity = constrained.identity
        } else if (constrained.attempts.length > 0) {
          identity = {
            ...identity,
            diagnostics: {
              ...identity.diagnostics,
              constraintAttempts: constrained.attempts,
              constraintAttemptGap: constrained.attemptGap,
              minimumConstraintAttemptGap: constrained.minimumAttemptGap,
            },
          }
        }
      }
      identity = {
        ...identity,
        rawTrait,
        rawLevel,
        levelOcr,
        level,
        stars,
        nature,
        panelStats,
        panelStatOcr,
        statTones,
      }
    }
    if (identity.value) {
      matched.patch.ref = identity.value
      matched.confidence.ref = identity.score
    }
    const genderCrop = cropImageSource(image, ROCK_SCANNER_CROP_PROFILE.gender, 1)
    const genderMatch = recognizeGenderColor(
      genderCrop.getContext('2d', { willReadFrequently: true })
        .getImageData(0, 0, genderCrop.width, genderCrop.height),
    )
    if (genderMatch) {
      matched.patch.gender = genderMatch.value
      matched.confidence.gender = genderMatch.confidence
    }
    const partnerMarkResult = await recognizeRockPartnerMark(image)
    if (partnerMarkResult.match) {
      matched.patch.partnerMark = partnerMarkResult.match.value
      matched.confidence.partnerMark = partnerMarkResult.match.score
    }
    const appearanceMatch = await recognizeRockAppearance(image)
    if (appearanceMatch) {
      matched.patch.appearance = appearanceMatch.value
      matched.confidence.appearance = appearanceMatch.score
    }
    patchFrame(frame.id, {
      raw: matched.raw,
      confidence: matched.confidence,
      values: { ...frame.values, ...matched.patch },
      identity,
      partnerMarkCandidates: partnerMarkResult.ranked,
      duplicateDecision: '',
      reviewed: false,
      status: matched.patch.ref
        ? '待复核'
        : identity.source === 'ambiguous'
          ? '同名形态待选择'
          : '未匹配精灵',
    })
  }

  async function recognizeSelected() {
    if (!selected) return
    setBusy('ocr')
    setError('')
    try {
      await recognizeFrame(selected)
      setProgress('识别完成。请核对所有字段；未识别的外观或性别需要手动选择。')
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
    const candidateSets = scannerCandidateSets(fields)
    return Object.entries(candidateSets).flatMap(([key, candidates]) => {
      const rawText = frame.raw?.[key] || ''
      const confidence = Number(frame.confidence?.[key]) || 0
      if (!rawText || (frame.values?.[key] && confidence >= 0.78)) return []
      const ranked = rankScanCandidates(rawText, candidates)
      if (!ranked[0] || ranked[0].score < 0.42) return []
      return [{
        key,
        rawText,
        candidates: ranked
          .filter((candidate) => candidate.score >= Math.max(0.42, ranked[0].score - 0.16))
          .slice(0, 8),
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
        duplicateDecision: '',
        reviewed: false,
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
    const nextSelectedId = scannerFrameSelectionAfterAction(
      frames,
      frame.id,
      { removing: true },
    )
    releaseLocalUrl(frame.url)
    setFrames((current) => current.filter((item) => item.id !== frame.id))
    if (selectedId === frame.id) setSelectedId(nextSelectedId)
  }

  function toggleFrameReviewed(frame) {
    const confirming = !frame.reviewed
    patchFrame(frame.id, {
      reviewed: confirming,
      status: confirming ? '已确认' : '待确认',
    })
    if (confirming) {
      setSelectedId(scannerFrameSelectionAfterAction(frames, frame.id))
    }
  }

  function frameHasBlockingDuplicate(frame) {
    return findScannerDuplicateCandidates(frame.values, ownedRows || [])
      .some((candidate) => candidate.blocking)
  }

  function frameCanSave(frame) {
    if (!isScannerFrameReady(frame)) return false
    return !frameHasBlockingDuplicate(frame) || frame.duplicateDecision === 'add'
  }

  async function saveReviewed() {
    const ready = frames.filter(frameCanSave)
    if (ready.length === 0) {
      setError('至少需要明确确认一帧完整记录。')
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
      const savedIds = new Set(ready.map((frame) => frame.id))
      setFrames((current) => current.filter((frame) => {
        if (!savedIds.has(frame.id)) return true
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

  const editableKeys = ['ref', 'nature', 'bloodline', 'appearance', 'specialty', 'partnerMark', 'gender']
  const editableFields = editableKeys.map((key) => fieldByKey(fields, key)).filter(Boolean)
  const readyCount = frames.filter(frameCanSave).length

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
        <div className="scanner-import-row">
          <label className="btn">
            <Video size={15} />
            选择视频
            <input
              type="file"
              accept="video/mp4"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                releaseLocalUrl(videoUrl)
                setVideoUrl(createLocalUrl(file))
                setVideoName(file.name)
                setVideoDimensions(null)
                setExtractionSummary(null)
                event.target.value = ''
              }}
            />
          </label>
          <button type="button" className="btn btn-primary" disabled={!videoUrl || Boolean(busy)} onClick={extractStableFrames}>
            {busy === 'extract-smart' ? '检测中…' : '智能提取稳定画面'}
          </button>
          {videoDimensions && (
            <span className="scanner-device-status">
              {videoDimensions.width}×{videoDimensions.height}
              {videoDimensions.matches ? ' · 固定设备' : ' · 规格不匹配'}
            </span>
          )}
          {extractionSummary && (
            <span className="scanner-device-status">
              智能提取：检查 {extractionSummary.checked} 个时间点 · 保留 {extractionSummary.kept} 张
              · 步长约 {extractionSummary.stepSeconds.toFixed(2)} 秒
              · {extractionSummary.mode}耗时约 {extractionSummary.elapsedSeconds.toFixed(1)} 秒
            </span>
          )}
        </div>

        <div className="scanner-help-grid">
          <details className="scanner-help-section">
            <summary>录屏方式</summary>
            <ol>
              <li>固定使用当前手机横屏录制：3200×1440、16 Mbps、24 fps、无声音。</li>
              <li>关闭“显示屏幕触摸”和“显示导航键点击”，避免触点覆盖识别区域。</li>
              <li>在精灵总览页开始录制；切换动画结束后，让信息面板终态稳定约 1 秒。</li>
              <li>导入原始 HEVC MP4，使用“智能提取”；不要先经过聊天软件压缩或视频剪辑转码。</li>
              <li>工具会联合选择列表和信息面板关键区域，只保留终态且不重复的画面。</li>
            </ol>
            <p>视频、截图和 OCR 默认只在当前浏览器本地处理，原媒体不会写入 IndexedDB。只有点击“AI 纠错”时，当前帧的低置信 OCR 文字和有限候选会发送给已配置模型，图片不会发送。</p>
          </details>

          <RockKingdomStatFormulaGuide
            scanner
            className="scanner-help-section"
            summary="六维与培养公式"
          />

          <details className="scanner-help-section">
            <summary>备用导入与排错</summary>
            <div className="scanner-import-row">
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
                <span>固定间隔</span>
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
          </details>
        </div>

        {videoUrl && (
          <div className="scanner-video">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              preload="metadata"
              onLoadedMetadata={(event) => {
                const video = event.currentTarget
                setVideoDimensions({
                  width: video.videoWidth,
                  height: video.videoHeight,
                  matches: video.videoWidth === ROCK_SCANNER_DEVICE_PROFILE.width
                    && video.videoHeight === ROCK_SCANNER_DEVICE_PROFILE.height,
                })
              }}
              onError={() => setError('无法解码固定手机录制的原始 HEVC MP4；请确认文件完整且未被聊天软件压缩或转码。')}
            />
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
                <span>裁切和终态锚点按固定手机的 3200×1440 横屏画面标定。</span>
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
                      aria-label={crop.label}
                      style={{
                        left: `${crop.x * 100}%`,
                        top: `${crop.y * 100}%`,
                        width: `${crop.width * 100}%`,
                        height: `${crop.height * 100}%`,
                      }}
                    />
                  ))}
                </div>
                {selectedDuplicateCandidates.length > 0 && (
                  <div className={`scanner-duplicate-warning ${selectedHasBlockingDuplicate ? 'is-blocking' : ''}`}>
                    <div className="scanner-duplicate-heading">
                      <AlertTriangle size={17} />
                      <strong>
                        {selectedHasBlockingDuplicate
                          ? `发现 ${selectedDuplicateCandidates.length} 条高度相似的已有记录`
                          : `发现 ${selectedDuplicateCandidates.length} 条可能相近的已有记录`}
                      </strong>
                    </div>
                    <p>
                      这是相似度提醒，不会自动覆盖或删除记录。等级、星级和雷达六维会随培养变化，不作为长期身份字段。
                    </p>
                    <details>
                      <summary>查看已有记录与比较依据</summary>
                      <ul>
                        {selectedDuplicateCandidates.slice(0, 6).map((candidate) => (
                          <li key={candidate.row.id}>
                            <strong>
                              {candidate.level === 'exact'
                                ? '四项完全一致'
                                : candidate.level === 'likely'
                                  ? '高度相似'
                                  : '部分相似'}
                            </strong>
                            <span>
                              {Object.keys(SCANNER_DUPLICATE_FIELD_LABELS).map((key) => (
                                `${SCANNER_DUPLICATE_FIELD_LABELS[key]}：${
                                  scannerFieldValueLabel(fields, key, candidate.row.values?.[key])
                                }`
                              )).join(' · ')}
                            </span>
                            <small>
                              一致：{candidate.matchingKeys
                                .map((key) => SCANNER_DUPLICATE_FIELD_LABELS[key])
                                .join('、') || '无'}
                              {candidate.conflictingKeys.length > 0
                                ? ` · 不同：${candidate.conflictingKeys
                                    .map((key) => SCANNER_DUPLICATE_FIELD_LABELS[key])
                                    .join('、')}`
                                : ''}
                              {' · '}血脉{candidate.bloodlineMatches ? '相同' : '不同或缺失'}
                              {' · '}伙伴标记{candidate.partnerMarkMatches ? '相同' : '不同或缺失'}
                              {candidate.row.createdAt
                                ? ` · 录入于 ${new Date(candidate.row.createdAt).toLocaleString('zh-CN')}`
                                : ''}
                            </small>
                          </li>
                        ))}
                      </ul>
                    </details>
                    <div className="scanner-duplicate-actions">
                      {selectedHasBlockingDuplicate && (
                        <button
                          type="button"
                          className={`btn ${selected.duplicateDecision === 'add' ? 'btn-primary' : ''}`}
                          onClick={() => patchFrame(selected.id, {
                            duplicateDecision: 'add',
                            reviewed: false,
                            status: '已确认仍然新增，待确认记录',
                          })}
                        >
                          {selected.duplicateDecision === 'add' ? '已选择仍然新增' : '仍然新增'}
                        </button>
                      )}
                      <button type="button" className="btn" onClick={() => removeFrame(selected)}>
                        跳过本帧
                      </button>
                    </div>
                  </div>
                )}
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
                    title={correctionFields(selected).length === 0 ? '仅纠正有文字证据的低置信字段；图标字段和空白 OCR 需要手动复核' : ''}
                  >
                    <Sparkles size={15} /> {busy === 'model' ? '纠错中…' : 'AI 纠错低置信字段'}
                  </button>
                  <button
                    type="button"
                    className={`btn ${selected.reviewed ? 'btn-primary' : ''}`}
                    disabled={
                      Boolean(busy)
                      || !selected.values.ref
                      || (
                        !selected.reviewed
                        && selectedHasBlockingDuplicate
                        && selected.duplicateDecision !== 'add'
                      )
                    }
                    title={
                      selectedHasBlockingDuplicate && selected.duplicateDecision !== 'add'
                        ? '请先查看已有记录，并选择仍然新增或跳过本帧'
                        : ''
                    }
                    onClick={() => toggleFrameReviewed(selected)}
                  >
                    <Check size={15} /> {selected.reviewed ? '取消确认' : '确认当前记录'}
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
                      {field.key === 'ref' && selected.identity && (
                        <>
                          <small className="scanner-ocr-raw">
                            识别依据：{identityEvidenceLabel(selected.identity)}
                            {selected.identity.candidates?.length > 1
                              ? ` · 候选 ${selected.identity.candidates.slice(0, 4).map((candidate) => candidate.label).join('、')}`
                              : ''}
                            {selected.identity.rawTrait ? ` · 特性 OCR：${selected.identity.rawTrait}` : ''}
                          </small>
                          <ScannerFormulaDiagnostics identity={selected.identity} />
                        </>
                      )}
                      {field.key === 'appearance' && (
                        <small className="scanner-ocr-raw">
                          {selected.confidence.appearance
                            ? `本地图标匹配 ${Math.round(selected.confidence.appearance * 100)}%，请对照原图复核。`
                            : '当前仅有 9 种清晰模板；未识别时请手动选择，不能把空值直接视为普通外观。'}
                        </small>
                      )}
                      {field.key === 'partnerMark' && (
                        <small className="scanner-ocr-raw">
                          {selected.confidence.partnerMark
                            ? `本地图标匹配 ${Math.round(selected.confidence.partnerMark * 100)}%，请对照血脉左侧图标复核；图标不会发送给 AI。`
                            : selected.partnerMarkCandidates?.length
                              ? `未达到本地图标门槛；最佳候选：${selected.partnerMarkCandidates
                                .map((candidate) => `${candidate.label} ${Math.round(candidate.score * 100)}%`)
                                .join('，')}。请手动复核。`
                              : '未检测到伙伴标记前景，请对照血脉左侧图标手动选择；AI 不会猜图标。'}
                        </small>
                      )}
                      {field.key === 'gender' && (
                        <small className="scanner-ocr-raw">
                          {selected.confidence.gender
                            ? `本地颜色识别 ${Math.round(selected.confidence.gender * 100)}%，请对照名称右侧符号复核。`
                            : '未清楚识别名称右侧的蓝色♂或红色♀，请手动选择。'}
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
