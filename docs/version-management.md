# 本地版本管理

仓库只在本地建立，尚未连接远程服务。

- `main`：本次调整前的完整基线，提交 `8b47fa2`。
- `baseline-before-preview`：同一基线的固定标签。
- `feat/immediate-platform-preview`：导入即预览及标签页图标调整。

修改前先用 `git status` 检查状态，每一组完整且已验证的修改保存为独立提交。

需要查看修改前版本时，先提交或暂存当前工作，再执行：

```sh
git switch --detach baseline-before-preview
```

返回当前开发版本：

```sh
git switch feat/immediate-platform-preview
```

这会切换项目文件；本地开发服务器也会随之显示对应版本。浏览器中的草稿保存在 localStorage，不属于 Git 版本记录。

本次验证：37 项测试通过、构建与类型检查通过；浏览器验证公众号与小红书切换、原稿展开、发布入口、真实文章导入（26 张配图）及 375px 布局。官方平台实际发布不在本次验证范围内。
