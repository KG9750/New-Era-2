# Codex Hooks

This project includes a hook-ready directory-index wrapper:

```bash
/Users/leo/Library/Mobile Documents/com~apple~CloudDocs/Personal/M3U Codex Workspace/Projects/Project-004-New Era 2/scripts/codex-project-directory-hook.sh
```

Recommended optional hook points:

- `user_prompt_submit`: refresh before Codex processes a user request.
- `stop`: refresh after Codex finishes a turn.

This project does not modify global Codex hook configuration automatically.
