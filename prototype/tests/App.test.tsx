import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App, CharacterDecisionPanel } from '../src/app/App'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'

const TEST_BUILD_METADATA = {
  buildId: 'g1-e2e-unit.1',
  gitSha: '1111111111111111111111111111111111111111',
  artifactHash: '2'.repeat(64),
  artifactHashAlgorithm: 'sha256-canonical-file-manifest-v1' as const,
  artifactManifestPath: 'artifact-manifest.json' as const,
  initialStateHash: 'fnv1a32-33a16fbf',
  initialStateHashAlgorithm: 'fnv1a32-stable-json-v1' as const,
}

function renderStartedApp() {
  render(<App buildMetadata={TEST_BUILD_METADATA} />)
  fireEvent.click(screen.getByRole('button', { name: '创建固定初态会话' }))
}

describe('minimal weekly flow UI', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens on the weekly issue summary instead of a full schedule grid', () => {
    renderStartedApp()

    expect(screen.getByRole('heading', { name: '本周三项取舍' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /水泵需要 2 个预防性维修块/ })).toBeInTheDocument()
    expect(screen.getByText(/点击“水泵需要 2 个预防性维修块”/)).toBeInTheDocument()
    expect(screen.queryByText('112')).not.toBeInTheDocument()
  })

  it('locates the activity block and immediately updates forecast and reason', () => {
    renderStartedApp()

    const forecastPanel = screen.getByRole('heading', { name: '粮食' }).closest('section')
    expect(forecastPanel).not.toBeNull()
    expect(within(forecastPanel!).getByText('3–11')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /水泵需要 2 个预防性维修块/ }))
    expect(
      screen.getByRole('button', { name: /水泵需要 2 个预防性维修块/ }),
    ).toHaveTextContent('已定位 · 待处理')
    fireEvent.click(screen.getByRole('button', { name: /补足第 2 个检修块/ }))

    expect(screen.getByRole('button', { name: /补足第 2 个检修块/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(forecastPanel!).getByText('9')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /水泵需要 2 个预防性维修块/ }),
    ).toHaveTextContent('已安排 · 等待事件')
    expect(screen.getByText(/已安排 2 个水泵维修块/)).toBeInTheDocument()
    expect(screen.getByText(/粮食 3–11 → 9；维修保障/)).toBeInTheDocument()
  })

  it('keeps the 112-cell week grid behind disclosure and supports one batch action', () => {
    renderStartedApp()

    expect(screen.queryByRole('grid', { name: '第 1 周完整计划' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '展开完整周计划' }))

    const grid = screen.getByRole('grid', { name: '第 1 周完整计划' })
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(112)
    expect(within(grid).getByText('林禾')).toBeInTheDocument()
    expect(within(grid).getByText('乔磐')).toBeInTheDocument()
    expect(within(grid).getByText('苏霁')).toBeInTheDocument()
    expect(within(grid).getByText('陈渡')).toBeInTheDocument()

    fireEvent.click(
      within(grid).getByRole('gridcell', { name: /林禾 第1日 B1 09–12/ }),
    )
    fireEvent.click(
      within(grid).getByRole('gridcell', { name: /乔磐 第1日 B1 09–12/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: '批量修改 2 格' }))

    expect(screen.getByText(/action-0001 作为一个事务修改 2 个活动块/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '撤销上次日程修改' })).toBeEnabled()
  })

  it('exposes explicit permanent scope, copy-day, undo, and a second 112-cell week', () => {
    renderStartedApp()
    fireEvent.click(screen.getByRole('button', { name: '展开完整周计划' }))

    expect(screen.getByRole('option', { name: '设为后续基础计划' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '复制这一天' }))
    expect(screen.getByRole('button', { name: '撤销上次日程修改' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: '撤销上次日程修改' }))
    expect(screen.getByText(/已撤销 action-0001，恢复 4 个活动块/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '第 2 周' }))
    expect(
      within(screen.getByRole('grid', { name: '第 2 周完整计划' })).getAllByRole('gridcell'),
    ).toHaveLength(112)
  })

  it('marks a mild food gap as accepted without changing its forecast math', () => {
    renderStartedApp()
    const foodPanel = screen.getByRole('heading', { name: '粮食' }).closest('section')
    expect(foodPanel).not.toBeNull()
    expect(within(foodPanel!).getByText('3–11')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '接受轻度粮食缺口' }))

    expect(within(foodPanel!).getByText('3–11')).toBeInTheDocument()
    expect(within(foodPanel!).getByText(/轻度缺口 · 已接受风险/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '撤回风险接受' })).toBeEnabled()
    expect(screen.getByText(/不再作为未处理错误催促/)).toBeInTheDocument()
  })

  it('shows Qiao Pan red-line warning before a third consecutive overtime is submitted', () => {
    renderStartedApp()
    fireEvent.click(screen.getByRole('button', { name: '展开完整周计划' }))
    const grid = screen.getByRole('grid', { name: '第 1 周完整计划' })
    for (const day of ['第1日', '第2日', '第3日']) {
      fireEvent.click(
        within(grid).getByRole('gridcell', {
          name: new RegExp(`乔磐 ${day} B4 20–23`),
        }),
      )
    }
    fireEvent.change(screen.getByLabelText('批量活动'), {
      target: { value: 'repair' },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('乔磐红线预警')
    expect(screen.getByRole('alert')).toHaveTextContent('第三个连续加班日')
    expect(screen.getByRole('button', { name: '先调整红线冲突' })).toBeDisabled()
  })

  it('shows both Lin He request consequences during week two', () => {
    const weekTwoState = {
      ...scenario.createInitialState(),
      recap: null,
      completedWeekIndexes: [0],
    }
    render(<CharacterDecisionPanel simulation={weekTwoState} />)

    expect(screen.getByText(/接受：粮食产出 −2/)).toBeInTheDocument()
    expect(screen.getByText(/拒绝：粮食不变/)).toBeInTheDocument()
  })

  it('renders the authoritative map route and updates loss and food after opening the shortcut', () => {
    renderStartedApp()
    const mapPanel = screen.getByRole('heading', {
      name: '运输路径与人物位置',
    }).closest('section')
    const foodPanel = screen.getByRole('heading', { name: '粮食' }).closest('section')
    expect(mapPanel).not.toBeNull()
    expect(foodPanel).not.toBeNull()
    expect(within(mapPanel!).getByText('北侧绕行 · 损耗 6')).toBeInTheDocument()
    expect(within(foodPanel!).getByText('3–11')).toBeInTheDocument()
    expect(within(mapPanel!).getByText(/远距离搬运损失 4/)).toBeInTheDocument()

    fireEvent.click(
      within(mapPanel!).getByRole('button', {
        name: '开启短通路 · 维修保障 −1',
      }),
    )

    expect(within(mapPanel!).getByText('南侧短通路 · 损耗 2')).toBeInTheDocument()
    expect(within(foodPanel!).getByText('7–15')).toBeInTheDocument()
    expect(screen.getByText(/北侧绕行 860 米 \/ 损耗 6 → 南侧短通路 470 米/)).toBeInTheDocument()
  })

  it('enters week two paused with inherited-plan context and only new exceptions', () => {
    vi.useFakeTimers()
    renderStartedApp()
    fireEvent.click(screen.getByRole('button', { name: '开始运行' }))
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByRole('heading', { name: /水泵故障并停机/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认后继续' }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByRole('heading', { name: /周末偏差复盘/ })).toBeInTheDocument()
    expect(screen.getByText('本周安排已完成并结算，不是被撤销')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '粮食' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保留休息' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('聚落时钟')).toHaveTextContent('复盘中')

    fireEvent.click(screen.getByRole('button', { name: '确认复盘并进入第二周' }))

    expect(screen.getByRole('heading', { name: '第二周新增例外' })).toBeInTheDocument()
    expect(screen.getByText('基础计划已继承')).toBeInTheDocument()
    expect(screen.getAllByText(/第一周一次性例外已结算失效/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /林禾请求周二 B1 学习/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '林禾 · 周二 B1' })).toBeInTheDocument()
    expect(screen.queryByText(/点击“水泵需要 2 个预防性维修块”/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /林禾请求周二 B1 学习/ }))
    expect(screen.getByRole('button', { name: '接受学习请求' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '拒绝并保留农务' })).toBeInTheDocument()
    expect(screen.getByLabelText('聚落时钟')).toHaveTextContent('已暂停')
    expect(screen.queryByRole('button', { name: /水泵需要 2 个预防性维修块/ })).not.toBeInTheDocument()
  })
})
