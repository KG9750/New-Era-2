import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App, CharacterDecisionPanel } from '../src/app/App'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'
import * as engine from '../src/sim/engine'

const TEST_BUILD_METADATA = {
  buildId: 'g1-e2e-unit.1',
  gitSha: '1111111111111111111111111111111111111111',
  artifactHash: '2'.repeat(64),
  artifactHashAlgorithm: 'sha256-canonical-file-manifest-v1' as const,
  artifactManifestPath: 'artifact-manifest.json' as const,
  initialStateHash: 'fnv1a32-6b11fd08',
  initialStateHashAlgorithm: 'fnv1a32-stable-json-v1' as const,
}

const TEST_SESSION_AUTHORITY = {
  diagnosisId: 'A38',
  sessionId: '11111111-1111-4111-8111-111111111111',
  candidateBuildAuthorityHash:
    TEST_BUILD_METADATA.artifactHash,
  sessionAuthorityToken: '3'.repeat(64),
}

function renderStartedApp() {
  render(
    <App
      buildMetadata={TEST_BUILD_METADATA}
      sessionAuthorityProvider={() => TEST_SESSION_AUTHORITY}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '创建固定初态会话' }))
}

describe('minimal weekly flow UI', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('opens on the weekly issue summary instead of a full schedule grid', () => {
    renderStartedApp()

    expect(screen.getByRole('heading', { name: '本周三项取舍' })).toBeInTheDocument()
    const comparisonEntry = screen.getByRole('button', { name: '比较容量取舍' })
    expect(comparisonEntry).toBeInTheDocument()
    expect(comparisonEntry.closest('article')).toHaveTextContent('预防容量分配')
    expect(comparisonEntry.closest('article')).toHaveTextContent('无默认或推荐')
    expect(comparisonEntry.closest('article')).not.toHaveTextContent(
      /安排第二次预防检修|保留休息容量/,
    )
    expect(screen.getByText(/从周初摘要定位预防检修日程/)).toBeInTheDocument()
    expect(screen.queryByRole('grid', { name: '第 1 周完整计划' })).not.toBeInTheDocument()
  })

  it('opens an unbiased repair comparison without mutating authority', async () => {
    renderStartedApp()
    const repairPanel = screen.getByRole('heading', { name: '维修保障' }).closest('section')
    expect(repairPanel).not.toBeNull()
    const forecastBefore = repairPanel!.textContent
    const comparisonTrigger = screen.getByRole('button', { name: '比较责任方向' })

    fireEvent.click(comparisonTrigger)

    const dialog = screen.getByRole('dialog', { name: '先比较后果，再把人员责任落到日程' })
    const optionList = within(dialog).getByRole('list', { name: '维修责任可行方案' })
    const optionButtons = within(optionList).getAllByRole('button')
    expect(optionButtons).toHaveLength(3)
    expect(optionButtons.map((button) => button.className)).toEqual([
      'comparison-option-action',
      'comparison-option-action',
      'comparison-option-action',
    ])
    for (const button of optionButtons) {
      expect(button).toHaveAttribute('aria-pressed', 'false')
      expect(button.className).not.toMatch(/primary|recommended/)
    }
    expect(dialog).not.toHaveTextContent(/推荐/)
    expect(screen.getByRole('button', { name: '关闭比较' })).toHaveFocus()
    expect(repairPanel!.textContent).toBe(forecastBefore)
    expect(screen.queryByRole('list', { name: '维修责任日程方案' })).not.toBeInTheDocument()

    fireEvent.keyDown(dialog, { key: 'Enter' })
    fireEvent.keyDown(dialog, { key: ' ' })
    expect(repairPanel!.textContent).toBe(forecastBefore)
    expect(screen.queryByRole('list', { name: '维修责任日程方案' })).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Escape' })
      await Promise.resolve()
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(comparisonTrigger).toHaveFocus()
  })

  it('keeps a responsibility direction non-numeric until a concrete schedule is confirmed', () => {
    renderStartedApp()
    const repairPanel = screen.getByRole('heading', { name: '维修保障' }).closest('section')
    const forecastBefore = repairPanel!.textContent

    fireEvent.click(screen.getByRole('button', { name: '比较责任方向' }))
    fireEvent.click(screen.getByRole('button', { name: '选择跨岗交接' }))

    expect(repairPanel!.textContent).toBe(forecastBefore)
    const scheduleOptions = screen.getByRole('list', { name: '维修责任日程方案' })
    expect(within(scheduleOptions).getAllByRole('listitem')).toHaveLength(2)
    expect(within(scheduleOptions).getByRole('button', { name: '确认陈渡日程' })).toBeInTheDocument()
    expect(within(scheduleOptions).getByRole('button', { name: '确认苏霁日程' })).toBeInTheDocument()

    fireEvent.click(within(scheduleOptions).getByRole('button', { name: '确认陈渡日程' }))

    expect(repairPanel!.textContent).not.toBe(forecastBefore)
    expect(screen.getByRole('status')).toHaveTextContent('陈渡的维修责任已由日程确认')
    expect(screen.getByRole('button', { name: '查看责任结果' })).toBeInTheDocument()
  })

  it('blocks a no-op responsibility confirmation and recovers through schedule undo', () => {
    renderStartedApp()
    fireEvent.click(screen.getByRole('button', { name: '展开完整周计划' }))
    const grid = screen.getByRole('grid', { name: '第 1 周完整计划' })
    fireEvent.click(
      within(grid).getByRole('gridcell', {
        name: /乔磐 第4日 B3 16–19 休息/,
      }),
    )
    fireEvent.change(screen.getByLabelText('批量活动'), {
      target: { value: 'repair' },
    })
    fireEvent.click(screen.getByRole('button', { name: '修改所选格' }))

    fireEvent.click(screen.getByRole('button', { name: '比较责任方向' }))
    fireEvent.click(screen.getByRole('button', { name: '选择维修专员承担' }))

    fireEvent.click(
      within(grid).getByRole('gridcell', {
        name: /乔磐 第4日 B3 16–19 维修/,
      }),
    )
    expect(
      screen.getByRole('button', { name: '所选格已是此活动' }),
    ).toBeDisabled()

    const noOpConfirmation = screen.getByRole('button', {
      name: '已是维修，不能重复确认',
    })
    expect(noOpConfirmation).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      '请先撤销包含它的旧事务，或改选其他责任方向',
    )

    fireEvent.click(screen.getByRole('button', { name: '撤销上次日程修改' }))
    const validConfirmation = screen.getByRole('button', {
      name: '确认乔磐日程',
    })
    expect(validConfirmation).toBeEnabled()
    fireEvent.click(validConfirmation)
    expect(screen.getByRole('status')).toHaveTextContent(
      '乔磐的维修责任已由日程确认',
    )
  })

  it('blocks a masked-scope copy from silently confirming responsibility', () => {
    renderStartedApp()
    fireEvent.click(screen.getByRole('button', { name: '展开完整周计划' }))
    const grid = screen.getByRole('grid', { name: '第 1 周完整计划' })

    fireEvent.click(
      within(grid).getByRole('gridcell', {
        name: /乔磐 第4日 B3 16–19 休息/,
      }),
    )
    fireEvent.change(screen.getByLabelText('批量活动'), {
      target: { value: 'repair' },
    })
    fireEvent.click(screen.getByRole('button', { name: '修改所选格' }))

    fireEvent.click(
      within(grid).getByRole('gridcell', {
        name: /乔磐 第5日 B4 20–23 社交/,
      }),
    )
    fireEvent.change(screen.getByLabelText('生效范围'), {
      target: { value: 'immediate' },
    })
    fireEvent.click(screen.getByRole('button', { name: '修改所选格' }))

    fireEvent.click(screen.getByRole('button', { name: '比较责任方向' }))
    fireEvent.click(screen.getByRole('button', { name: '选择维修专员承担' }))
    fireEvent.change(screen.getByLabelText('复制成员'), {
      target: { value: 'qiao-pan' },
    })
    fireEvent.change(screen.getByLabelText('复制来源日'), {
      target: { value: '4' },
    })
    fireEvent.change(screen.getByLabelText('复制目标日'), {
      target: { value: '3' },
    })
    fireEvent.change(screen.getByLabelText('生效范围'), {
      target: { value: 'base' },
    })

    expect(
      screen.getByRole('button', {
        name: '责任格已是维修，先撤销旧事务',
      }),
    ).toBeDisabled()
  })

  it('does not infer a management commitment from a low-level schedule edit', () => {
    renderStartedApp()
    fireEvent.click(screen.getByRole('button', { name: '展开完整周计划' }))
    const grid = screen.getByRole('grid', { name: '第 1 周完整计划' })
    fireEvent.click(
      within(grid).getByRole('gridcell', {
        name: /林禾 第2日 B2 13–16 休息/,
      }),
    )
    fireEvent.change(screen.getByLabelText('批量活动'), {
      target: { value: 'repair' },
    })
    fireEvent.change(screen.getByLabelText('生效范围'), {
      target: { value: 'immediate' },
    })
    fireEvent.click(screen.getByRole('button', { name: '修改所选格' }))

    fireEvent.click(screen.getByRole('button', { name: '比较容量取舍' }))

    const maintenance = screen.getByRole('button', {
      name: '安排第二次预防检修',
    })
    const protectedRecovery = screen.getByRole('button', {
      name: '指定保护性恢复',
    })
    expect(maintenance).toBeDisabled()
    expect(protectedRecovery).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(
      '真实经营结果继续生效，但系统不会事后补记本次管理意图',
    )
    expect(maintenance).toHaveAttribute('aria-pressed', 'false')
    expect(protectedRecovery).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.getByRole('button', { name: '比较容量取舍' }),
    ).toBeInTheDocument()
  })

  it('commits only after a concrete capacity candidate is keyboard-activated', () => {
    renderStartedApp()

    const forecastPanel = screen.getByRole('heading', { name: '粮食' }).closest('section')
    expect(forecastPanel).not.toBeNull()
    expect(within(forecastPanel!).getByText('3–11')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '比较容量取舍' }))
    const dialog = screen.getByRole('dialog', {
      name: '一个休息格，两种持久后果',
    })
    fireEvent.keyDown(dialog, { key: 'Enter' })
    fireEvent.keyDown(dialog, { key: ' ' })
    expect(within(forecastPanel!).getByText('3–11')).toBeInTheDocument()

    const maintenance = within(dialog).getByRole('button', {
      name: '安排第二次预防检修',
    })
    maintenance.focus()
    fireEvent.click(maintenance, { detail: 0 })

    expect(maintenance).toHaveAttribute('aria-pressed', 'true')
    expect(maintenance).toBeDisabled()
    expect(
      within(dialog).getByRole('button', { name: '指定保护性恢复' }),
    ).toBeDisabled()
    expect(within(forecastPanel!).getByText('9')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '查看容量结果' }).closest('article'),
    ).toHaveTextContent('设备暴露降为 low')
  })

  it('shows a player-facing message when a management choice commit is rejected', () => {
    renderStartedApp()
    vi.spyOn(engine, 'applyPlayerAction').mockImplementationOnce(() => {
      throw new engine.ManagementChoiceCommitError(
        'STATE_REVISION_CONFLICT',
      )
    })

    fireEvent.click(
      screen.getByRole('button', { name: '比较容量取舍' }),
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: '安排第二次预防检修',
      }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      '状态刚刚发生变化，请重新打开比较后再选择。',
    )
  })

  it('keeps the retained-rest result and its committed schedule slot locked', () => {
    renderStartedApp()

    fireEvent.click(screen.getByRole('button', { name: '比较容量取舍' }))
    fireEvent.click(screen.getByRole('button', { name: '指定保护性恢复' }))

    const schedulePanel = screen.getByRole('heading', {
      name: '林禾 · 周二 B2',
    }).closest('section')
    expect(schedulePanel).not.toBeNull()
    expect(within(schedulePanel!).getByText('休息 · 基础计划')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '查看容量结果' }).closest('article'),
    ).toHaveTextContent('人员准备度 +1')
    expect(
      screen.getByRole('button', { name: '指定保护性恢复' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: '安排第二次预防检修' }),
    ).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '展开完整周计划' }))
    const committedCell = within(
      screen.getByRole('grid', { name: '第 1 周完整计划' }),
    ).getByRole('gridcell', {
      name: /林禾 第2日 B2 13–16 休息.*管理选择锁定/,
    })
    expect(committedCell).toBeDisabled()
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
      currentTick: 1062,
      recap: null,
      completedWeekIndexes: [0],
    }
    render(<CharacterDecisionPanel simulation={weekTwoState} />)

    expect(screen.getByText(/接受：粮食产出 −2/)).toBeInTheDocument()
    expect(screen.getByText(/拒绝：粮食不变/)).toBeInTheDocument()
  })

  it('does not reveal the week-two request while the clock is still at tick 1002', () => {
    render(
      <CharacterDecisionPanel
        simulation={{
          ...scenario.createInitialState(),
          currentTick: 1002,
          recap: null,
          completedWeekIndexes: [0],
        }}
      />,
    )

    expect(screen.queryByText(/接受：粮食产出 −2/)).not.toBeInTheDocument()
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
    const recap = screen.getByRole('heading', {
      name: /周末偏差复盘/,
    }).closest('section')
    expect(recap).not.toBeNull()
    expect(recap).not.toHaveTextContent(/terminalState=|unqualified-direct-edit/)
    expect(screen.queryByRole('heading', { name: '粮食' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保留休息' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('聚落时钟')).toHaveTextContent('复盘中')

    fireEvent.click(screen.getByRole('button', { name: '确认复盘并进入第二周' }))

    expect(screen.getByRole('heading', { name: '第二周新增例外' })).toBeInTheDocument()
    expect(screen.getByLabelText('聚落时钟')).toHaveTextContent('周一 09:00')
    expect(screen.getByText('基础计划已继承')).toBeInTheDocument()
    expect(screen.getAllByText(/第一周一次性例外已结算失效/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '比较回应方案' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '林禾 · 周二 B1' })).toBeInTheDocument()
    expect(screen.queryByText(/从周初摘要定位预防检修日程/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '比较回应方案' }))
    const requestDialog = screen.getByRole('dialog', { name: '林禾的学习请求' })
    const requestActions = within(requestDialog).getAllByRole('button')
      .filter((button) => button.className === 'comparison-option-action')
    expect(requestActions).toHaveLength(2)
    expect(requestActions[0].className).toBe(requestActions[1].className)
    expect(screen.getByRole('button', { name: '关闭比较' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: '使用化肥：粮食 +6' }))
    expect(
      screen.getByRole('button', { name: '定位资源取舍' }).closest('article'),
    ).toHaveTextContent('化肥已在第二周使用')
    expect(
      screen.getByRole('button', { name: '定位资源取舍' }).closest('article'),
    ).toHaveTextContent('本周已使用化肥，库存为 0')
    expect(screen.getByLabelText('聚落时钟')).toHaveTextContent('已暂停')
    expect(screen.queryByRole('button', { name: '定位日程方案' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '比较应急班次' }))
    const recoveryDialog = screen.getByRole('dialog', {
      name: '同一个应急班次投向哪里',
    })
    const sharedState = within(recoveryDialog).getByLabelText(
      '恢复资源共享状态',
    )
    expect(sharedState).toHaveTextContent('当前粮食')
    expect(sharedState).toHaveTextContent('目标 ≥12')
    expect(sharedState).toHaveTextContent('当前维修')
    expect(sharedState).toHaveTextContent('目标 ≥5')
    expect(sharedState).toHaveTextContent(/设备负荷.*(?:稳定|脆弱)/)
    expect(sharedState).toHaveTextContent('基础设施压力')

    const recoveryCandidates = within(recoveryDialog).getAllByRole(
      'listitem',
    )
    expect(recoveryCandidates).toHaveLength(2)
    for (const candidate of recoveryCandidates) {
      expect(candidate).toHaveTextContent('选择后粮食')
      expect(candidate).toHaveTextContent('选择后维修')
      expect(candidate).toHaveTextContent('负荷')
      expect(candidate).toHaveTextContent('准备度')
      expect(candidate).toHaveTextContent('压力')
    }
  })

  it('keeps one complete export immutable across a failed save and retry', async () => {
    vi.useFakeTimers()
    const requestBodies: string[] = []
    const fixedSha256 = 'ab'.repeat(32)
    const realCrypto = globalThis.crypto
    const cryptoMock = {
      randomUUID: realCrypto.randomUUID.bind(realCrypto),
      subtle: {
        digest: vi
          .fn()
          .mockResolvedValue(Uint8Array.from({ length: 32 }, () => 0xab).buffer),
      },
    } as unknown as Crypto
    vi.stubGlobal('crypto', cryptoMock)
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const rawJson = String(init?.body)
      requestBodies.push(rawJson)
      if (requestBodies.length === 1) {
        return new Response(
          JSON.stringify({ error: '同一会话证据链缺失或不一致' }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }
      const payload = JSON.parse(rawJson)
      const filename =
        `${payload.meta.buildId}-${payload.meta.sampleId}-${payload.meta.sessionId}.json`
      return new Response(
        JSON.stringify({
          schemaVersion: 'gate1-capture-receipt-v1',
          captureVersion: 'gate1-capture-host-v1',
          filename,
          bytes: new TextEncoder().encode(rawJson).byteLength,
          sha256: fixedSha256,
          capturedAtUtc: '2026-07-26T06:00:00.000Z',
          sampleId: payload.meta.sampleId,
          sessionId: payload.meta.sessionId,
          buildId: payload.meta.buildId,
          gitSha: payload.meta.gitSha,
          artifactHash: payload.meta.artifactHash,
          downloadUrl: '/__gate1/capture/123e4567-e89b-42d3-a456-426614174000',
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)

    renderStartedApp()
    fireEvent.click(screen.getByRole('button', { name: '8×' }))
    fireEvent.click(screen.getByRole('button', { name: '开始运行' }))
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    fireEvent.click(screen.getByRole('button', { name: '确认后继续' }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    fireEvent.click(
      screen.getByRole('button', { name: '确认复盘并进入第二周' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: '开启短通路 · 维修保障 −1' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: '比较回应方案' }),
    )
    fireEvent.click(screen.getByRole('button', { name: '接受学习请求' }))
    fireEvent.click(screen.getByRole('button', { name: '开始运行' }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(screen.getByText('第 2 周结束')).toBeInTheDocument()
    const clearButton = screen.getByRole('button', {
      name: '结束并清空会话',
    })
    expect(clearButton).toBeDisabled()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '下载匿名 JSON' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      '同一会话证据链缺失或不一致',
    )
    expect(screen.getByRole('region', {
      name: '当前测试会话元数据',
    })).toBeInTheDocument()
    expect(clearButton).toBeDisabled()
    expect(anchorClick).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '下载匿名 JSON' }))
    })
    expect(screen.getByText(/已保存并校验 tick 2010/)).toHaveTextContent(
      '已保存并校验 tick 2010 的匿名记录。',
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestBodies[1]).toBe(requestBodies[0])
    const payload = JSON.parse(requestBodies[1])
    const continueAction = payload.actions.find(
      (entry: { id: string; type: string }) =>
        entry.type === 'CONTINUE_TO_NEXT_WEEK',
    )
    expect(continueAction).toBeDefined()
    expect(
      payload.domainEvents.find(
        (entry: { eventId: string }) => entry.eventId === continueAction.id,
      ),
    ).toMatchObject({ type: 'clock-changed', atTick: 1002 })
    expect(
      payload.candidateEditGroups,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupId: 'legacy:w1:transport-route',
          actionIds: [expect.any(String)],
        }),
      ]),
    )
    expect(payload.candidateManagementCommitmentGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decisionIntentId: 'w1:transport-route',
          finalDisposition: 'committed',
        }),
      ]),
    )
    expect(
      payload.telemetry,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'week-started',
          atTick: 1062,
          weekIndex: 1,
        }),
      ]),
    )
    expect(
      payload.telemetry.filter(
        (entry: { type: string }) => entry.type === 'export-created',
      ),
    ).toHaveLength(1)
    expect(anchorClick).toHaveBeenCalledTimes(1)
    expect(clearButton).toBeEnabled()

    fireEvent.click(clearButton)
    expect(
      screen.getByRole('heading', { name: '开始匿名新会话' }),
    ).toBeInTheDocument()
  })

  it('keeps one blocked capture immutable across a failed save and retry', async () => {
    const requestBodies: string[] = []
    const fixedSha256 = 'cd'.repeat(32)
    const realCrypto = globalThis.crypto
    const cryptoMock = {
      randomUUID: realCrypto.randomUUID.bind(realCrypto),
      subtle: {
        digest: vi
          .fn()
          .mockResolvedValue(Uint8Array.from({ length: 32 }, () => 0xcd).buffer),
      },
    } as unknown as Crypto
    vi.stubGlobal('crypto', cryptoMock)
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const rawJson = String(init?.body)
      requestBodies.push(rawJson)
      if (requestBodies.length === 1) {
        return new Response(
          JSON.stringify({ error: '同一会话证据链缺失或不一致' }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }
      const payload = JSON.parse(rawJson)
      const filename =
        `${payload.meta.buildId}-${payload.meta.sampleId}-${payload.meta.sessionId}.json`
      return new Response(
        JSON.stringify({
          schemaVersion: 'gate1-capture-receipt-v1',
          captureVersion: 'gate1-capture-host-v1',
          filename,
          bytes: new TextEncoder().encode(rawJson).byteLength,
          sha256: fixedSha256,
          capturedAtUtc: '2026-07-26T06:00:00.000Z',
          sampleId: payload.meta.sampleId,
          sessionId: payload.meta.sessionId,
          buildId: payload.meta.buildId,
          gitSha: payload.meta.gitSha,
          artifactHash: payload.meta.artifactHash,
          downloadUrl: '/__gate1/capture/123e4567-e89b-42d3-a456-426614174001',
          captureKind: 'blocked',
          blockedAtTick: payload.blockedAtTick,
          isComplete: false,
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)

    renderStartedApp()
    const clearButton = screen.getByRole('button', {
      name: '结束并清空会话',
    })
    const blockedReason = screen.getByRole('textbox', {
      name: /阻断原因/,
    })
    fireEvent.change(blockedReason, {
      target: { value: 'tick 54 无法继续，复现步骤固定。' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '保存阻断记录' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      '同一会话证据链缺失或不一致',
    )
    expect(blockedReason).toBeDisabled()
    expect(clearButton).toBeDisabled()
    expect(
      screen.getByRole('button', { name: '保存阻断记录' }),
    ).toBeEnabled()
    expect(anchorClick).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '保存阻断记录' }))
    })
    expect(screen.getByText(/已保存并校验 tick 54/)).toHaveTextContent(
      '已保存并校验 tick 54 的阻断记录（非完整场次）。',
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestBodies[1]).toBe(requestBodies[0])
    const payload = JSON.parse(requestBodies[1])
    expect(payload.captureKind).toBe('blocked')
    expect(payload.blockedAtTick).toBe(54)
    expect(payload.finalState.isComplete).toBe(false)
    expect(
      payload.telemetry.filter(
        (entry: { type: string }) => entry.type === 'blocked-capture-created',
      ),
    ).toHaveLength(1)
    expect(
      payload.telemetry.filter(
        (entry: { type: string }) => entry.type === 'export-created',
      ),
    ).toHaveLength(0)
    expect(anchorClick).toHaveBeenCalledTimes(1)
    expect(clearButton).toBeEnabled()
  })
})
