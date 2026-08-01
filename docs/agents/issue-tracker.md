# Issue tracker: GitHub

本项目的 Issues 和相关工作项位于 GitHub 仓库 `KG9750/New-Era-2`，使用 `gh` CLI 操作。

## Conventions

- 创建：`gh issue create --title "..." --body-file <file>`
- 查看：`gh issue view <number> --comments`
- 列表：`gh issue list --state open --json number,title,body,labels,comments`
- 评论：`gh issue comment <number> --body "..."`
- 添加或移除标签：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- 关闭：`gh issue close <number> --comment "..."`

在仓库 checkout 内运行时由 `gh` 自动识别远端。skill 中的“发布到 issue tracker”均表示创建 GitHub Issue。

正式实现 Issue 应引用已经推送到远端的设计或计划基线，不引用仅存在于本地未提交工作树的内容。
