# Frontend

Frontend implementation entrypoint for `Project-004-New Era 2`.

## Defaults

- Match the existing design system before adding new patterns.
- Prefer real states and workflows over static mockups.
- Verify responsive behavior when changing UI.

## Notes

- 当前原型介质为 React + TypeScript + Vite Web，代码已位于 `prototype/`；它不是未来占位目录。
- 当前工作区分支以地图设计与专项资产为主，不能作为正式 RC。React 实现的远端主线为 `codex/gate1-react-web`，正式验证必须从精确冻结 ref 的 clean clone/worktree 运行。
- Gate 1 桌面优先，1440×900 和 1280×720 为 RC 阻塞视口，1024×768 只作观察性回归；本轮不做完整移动端适配。
- 模拟规则必须位于无 React/DOM 依赖的纯 TypeScript 内核，React 只负责呈现与玩家输入。
- Gate 2 复用 Gate 1 的同一 Web 和模拟内核；只有 Gate 1H 真人 `PASS` 后才允许编写 Gate 2 规格，当前不得实现主题、NPC 和豁免功能。
- Gate 1 首轮只保存内存会话并导出匿名 JSON，不建设重放、检查点、`localStorage` 恢复、观察员面板或 Balance Lab。
- C04 的 Source/Integration 自动验证曾达到 Vitest `387/387` 与 RC E2E `26/26`，但 P07 浏览器 transport 失败后 C04 已拒绝；这些测试数字不得作为当前 RC 或 Gate 状态。
- 详细技术与测试约束见 `docs/exec-plans/active/2026-07-26-react-web-gate-1-2-development-plan.md`。
