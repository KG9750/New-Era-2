# Frontend

Frontend implementation entrypoint for `Project-004-New Era 2`.

## Defaults

- Match the existing design system before adding new patterns.
- Prefer real states and workflows over static mockups.
- Verify responsive behavior when changing UI.

## Notes

- 当前原型介质为 React + TypeScript + Vite Web，代码放在未来的 `prototype/` 目录。
- Gate 1 桌面优先，1440×900 和 1280×720 为 RC 阻塞视口，1024×768 只作观察性回归；本轮不做完整移动端适配。
- 模拟规则必须位于无 React/DOM 依赖的纯 TypeScript 内核，React 只负责呈现与玩家输入。
- Gate 2 复用 Gate 1 的同一 Web 和模拟内核；Gate 1 `PASS` 前不得实现主题、NPC 和豁免功能。
- Gate 1 首轮只保存内存会话并导出匿名 JSON，不建设重放、检查点、`localStorage` 恢复、观察员面板或 Balance Lab。
- 详细技术与测试约束见 `docs/exec-plans/active/2026-07-26-react-web-gate-1-2-development-plan.md`。
