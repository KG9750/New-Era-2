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
})
