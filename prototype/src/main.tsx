import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { loadRcBuildMetadata } from './build-metadata'
import './styles/app.css'

const root = createRoot(document.getElementById('root')!)

loadRcBuildMetadata()
  .then((buildMetadata) => {
    root.render(
      <StrictMode>
        <App buildMetadata={buildMetadata} />
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : '未知错误'
    root.render(
      <main className="session-gate">
        <section className="session-card" role="alert">
          <p className="eyebrow">Gate 1 · 构建冻结失败</p>
          <h1>无法启动测试会话</h1>
          <p>{message}</p>
          <p>请由测试运营负责人重新核对冻结构建，不要在未确认指纹时开始样本。</p>
        </section>
      </main>,
    )
  })
