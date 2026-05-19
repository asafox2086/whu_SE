# 本地数据库

这个目录用于保存 MVP 的本地演示数据。

- `state.example.json`: 可提交的示例数据结构，便于理解本地状态包含哪些表。
- `state.local.json`: 运行 `npm start` 后由本地服务读写的实际数据文件，已加入 `.gitignore`，不会提交到 GitHub。

如果需要重置演示数据，停止服务后删除 `state.local.json`，再次启动会回到内置种子数据。
