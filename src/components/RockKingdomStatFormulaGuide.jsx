export function RockKingdomStatFormulaGuide({ scanner = false }) {
  return (
    <details className="rock-stat-formula-guide">
      <summary>查看六维与培养公式</summary>
      <div className="rock-stat-formula-guide-body">
        <p>
          <strong>资料库六维</strong>是当前形态固定的基础资质；
          <strong>雷达图六维</strong>是这只精灵经过等级、星级、性格和天分修正后的当前面板，两者不会直接相等。
          游戏资质弹窗中的白色数字对应基础资质，黄色 <code>+n</code> 对应当前星级下的有效天分。
        </p>
        <p>
          设基础资质为 <code>B</code>、等级为 <code>L</code>、星级为 <code>S</code>、
          初始天分为 <code>T</code>，则有效天分 <code>I = T × (S + 1)</code>。
          性格倍率 <code>M</code>：强化项为 <code>1.1 + 0.02 × S</code>，弱化项为 <code>0.9</code>，其余为 <code>1</code>。
        </p>
        <div className="rock-stat-formula-lines">
          <code>生命 = round(round((B + I / 2) × (0.5 + L / 50) + L + 10) × M + 20 × S)</code>
          <code>其他五维 = round(round((B + I / 2) × (0.5 + L / 100) + 10) × M + 10 × S)</code>
        </div>
        <p>
          已知取整边界：60 级时，非生命基础资质恰为 105、该项无天分且性格中性，
          游戏实际面板比通式普通四舍五入少 1；工具已按实测校正。
        </p>
        <p>
          三项天分加成的初始值各为 7～10，升星后黄色数值随之增长；性格推荐页由你选择三项并按初始 +10 预览满培养面板。
          {scanner && '扫描画面不展示具体天分，因此形态判断会枚举三项落点及每项 7～10 的全部组合；只在公式误差足够低且明显领先其他形态时采用结果。'}
        </p>
      </div>
    </details>
  )
}
