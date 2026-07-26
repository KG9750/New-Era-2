# Domain Docs

本项目采用 single-context 布局。

## Read order

进入项目或编写 Issue 前按以下顺序读取：

1. 根目录 `CONTEXT.md`：项目边界和当前 Gate 状态；
2. `PLANS.md`：活跃计划与执行顺序；
3. `DESIGN.md`：设计主线与权威设计文档；
4. `FRONTEND.md`：Web 原型的实现边界；
5. 与当前任务直接相关的规格、测试协议和执行计划；
6. `docs/adr/` 中与当前任务相关的 ADR；目录不存在时直接继续。

## Consumer rules

- 使用领域文档中的既有术语，不自行创造同义名称；
- 区分“已确认规则”“待原型验证假设”和“专项待办”；
- Gate 1 `PASS` 前不得把 Gate 2 功能写入可执行 Issue；
- 生成目录只用于定位，不是规则真相源；
- 若 Issue 与现有 Gate 或 ADR 冲突，必须在 Issue 中明确指出。
