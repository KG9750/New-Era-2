import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../src/app/App'

describe('minimal weekly flow UI', () => {
  it('opens on the weekly issue summary instead of a full schedule grid', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '本周先处理这一件事' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /水泵需要预防性检修/ })).toBeInTheDocument()
    expect(screen.getByText('点击上方问题卡，定位受影响的活动块。')).toBeInTheDocument()
    expect(screen.queryByText('112')).not.toBeInTheDocument()
  })

  it('locates the activity block and immediately updates forecast and reason', () => {
    render(<App />)

    const forecastPanel = screen.getByRole('heading', { name: '粮食' }).closest('section')
    expect(forecastPanel).not.toBeNull()
    expect(within(forecastPanel!).getByText('3–11')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /水泵需要预防性检修/ }))
    fireEvent.click(screen.getByRole('button', { name: /检修水泵/ }))

    expect(screen.getByRole('button', { name: /检修水泵/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(forecastPanel!).getByText('11')).toBeInTheDocument()
    expect(screen.getByText(/故障风险已从预测中移除/)).toBeInTheDocument()
    expect(screen.getByText(/粮食期末预测由 3–11 变为 11/)).toBeInTheDocument()
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
})
