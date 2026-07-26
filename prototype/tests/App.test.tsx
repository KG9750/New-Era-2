import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App, CharacterDecisionPanel } from '../src/app/App'
import { gate1WeekOneScenario as scenario } from '../src/scenario/gate1-week-one'

describe('minimal weekly flow UI', () => {
  it('opens on the weekly issue summary instead of a full schedule grid', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '本周三项取舍' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /水泵需要 2 个预防性维修块/ })).toBeInTheDocument()
    expect(screen.getByText(/点击“水泵需要 2 个预防性维修块”/)).toBeInTheDocument()
    expect(screen.queryByText('112')).not.toBeInTheDocument()
  })

  it('locates the activity block and immediately updates forecast and reason', () => {
    render(<App />)

    const forecastPanel = screen.getByRole('heading', { name: '粮食' }).closest('section')
    expect(forecastPanel).not.toBeNull()
    expect(within(forecastPanel!).getByText('3–11')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /水泵需要 2 个预防性维修块/ }))
    fireEvent.click(screen.getByRole('button', { name: /补足第 2 个检修块/ }))

    expect(screen.getByRole('button', { name: /补足第 2 个检修块/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(forecastPanel!).getByText('9')).toBeInTheDocument()
    expect(screen.getByText(/已安排 2 个水泵维修块/)).toBeInTheDocument()
    expect(screen.getByText(/粮食 3–11 → 9；维修保障/)).toBeInTheDocument()
  })

  it('keeps the 112-cell week grid behind disclosure and supports one batch action', () => {
    render(<App />)

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
    render(<App />)
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
    render(<App />)
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
    render(<App />)
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

  it('exposes both Lin He request choices during week two as independent player actions', () => {
    const submit = vi.fn()
    const weekTwoState = {
      ...scenario.createInitialState(),
      recap: null,
      completedWeekIndexes: [0],
    }
    render(<CharacterDecisionPanel simulation={weekTwoState} submit={submit} />)

    fireEvent.click(screen.getByRole('button', { name: '接受学习请求' }))
    fireEvent.click(screen.getByRole('button', { name: '拒绝并保留农务' }))

    expect(submit).toHaveBeenNthCalledWith(1, {
      type: 'RESOLVE_LIN_HE_REQUEST',
      decision: 'accepted',
    })
    expect(submit).toHaveBeenNthCalledWith(2, {
      type: 'RESOLVE_LIN_HE_REQUEST',
      decision: 'declined',
    })
    expect(screen.getByText(/接受：粮食产出 −2/)).toBeInTheDocument()
  })
})
