import { useState } from 'react'
import { gate1WeekOneScenario as scenario } from '../scenario/gate1-week-one'
import { RC_BUILD_ID } from '../telemetry/session'

interface SessionGateProps {
  wasCleared: boolean
  onStart(sampleId: string): void
}

const SAMPLE_ID_PATTERN = /^(?:A\d{2,}|P\d{2,}|M-[ABC])$/

export function SessionGate({
  wasCleared,
  onStart,
}: SessionGateProps) {
  const [sampleId, setSampleId] = useState('M-C')
  const normalizedSampleId = sampleId.trim().toUpperCase()
  const valid = SAMPLE_ID_PATTERN.test(normalizedSampleId)

  return (
    <main className="session-gate">
      <section className="session-card" aria-labelledby="session-title">
        <div>
          <p className="eyebrow">Gate 1 · 固定初态测试入口</p>
          <h1 id="session-title">开始匿名新会话</h1>
          <p>
            每次开始都会重建相同场景，并清空上一场的动作、事件与计时。
            编号由测试运营台账连续分配，本页不保存真实身份。
          </p>
        </div>

        <dl className="session-build-grid">
          <div><dt>构建编号</dt><dd>{RC_BUILD_ID}</dd></div>
          <div><dt>场景版本</dt><dd>{scenario.version}</dd></div>
          <div><dt>固定种子</dt><dd>{scenario.fixedSeed}</dd></div>
        </dl>

        <label className="sample-id-field">
          匿名编号
          <input
            aria-describedby="sample-id-help"
            autoComplete="off"
            maxLength={8}
            onChange={(event) => setSampleId(event.target.value)}
            spellCheck={false}
            value={sampleId}
          />
        </label>
        <small id="sample-id-help">
          允许 A01、P01 或里程碑 M-A / M-B / M-C；当前场开始后不可修改。
        </small>
        {!valid && sampleId.length > 0 && (
          <p className="field-error" role="alert">请输入有效的匿名编号。</p>
        )}
        {wasCleared && (
          <p className="cleared-session-note">
            上一场已从网页内存清空；下载到操作系统的文件不受网页清空影响。
          </p>
        )}
        <button
          disabled={!valid}
          onClick={() => onStart(normalizedSampleId)}
          type="button"
        >
          创建固定初态会话
        </button>
      </section>
    </main>
  )
}
