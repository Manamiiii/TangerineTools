import manifest from '../presets/rockKingdomSources.json'

export function SourceDetails() {
  return (
      <div className="data-source-notice">
        <section>
          <h3>TangerineTools 项目代码</h3>
          <p>Copyright © 2026 TangerineTools contributors</p>
          <p>项目自有代码采用 GNU GPL v3.0（GPL-3.0-only），允许按协议修改和再分发，不作担保；第三方资料与素材按各自许可处理。</p>
          <p><a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noreferrer">阅读 GPL v3.0</a> · <a href="https://github.com/Manamiiii/TangerineTools" target="_blank" rel="noreferrer">项目源码</a></p>
        </section>
        <p>洛克王国世界内置资料来自以下 Wiki。资料详情提供对应原页面链接；本地修改后的内容可能与原页面不同。</p>
        {Object.entries(manifest.sources).map(([key, source]) => <section key={key}>
          <h3><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a></h3>
          <p>{source.authors}</p>
          <p><a href={source.licenseUrl} target="_blank" rel="noreferrer">{source.license}</a> · {source.scope}</p>
          {source.statementUrl && <a href={source.statementUrl} target="_blank" rel="noreferrer">阅读站点声明</a>}
        </section>)}
        <p>{manifest.modifications}</p>
        <p>精灵来源批次：{manifest.sourceVersions.creatures}<br />技能来源批次：{manifest.sourceVersions.skills}</p>
        <p>{manifest.assets}</p>
        <p>Wiki 是非官方资料站。TangerineTools 与游戏官方及来源站点无隶属或授权关系。资料许可按其适用范围保留，不代表游戏素材、项目代码或个人收集记录采用相同许可。</p>
      </div>
  )
}

export function RowSourceLink({ row }) {
  const source = manifest.rows[row?.id]
  if (!source) return null
  return <p className="row-source-link">
    预置资料来源：<a href={source.url} target="_blank" rel="noreferrer">{source.name} · {manifest.sources[source.source].name}</a>
    <span>本地自定义值以你的记录为准。</span>
  </p>
}
