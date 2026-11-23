# 本地版本管理

公开仓库：https://github.com/STRUGGLE1999/PrismPress 。本地实名规划记录、对话与浏览器产物未上传；发布前原始历史保存在本机 `.git/local-backups/before-public.bundle`。

- `main`：正式版本分支，推送后由 Vercel Git 集成触发生产部署。修改前基线使用标签 `baseline-before-preview` 定位。
- `codex/review-fixes`：当前开发分支；先本地验证，用户确认后再将完整修改单元快进至 `main`。推送开发分支也可能生成预览部署，不能把预览状态当成生产上线。
- `baseline-before-preview`：同一基线的固定标签。
- `feat/immediate-platform-preview`：导入即预览及标签页图标调整。

修改前先用 `git status` 检查状态，每一组完整且已验证的修改保存为独立提交。

需要查看修改前版本时，先提交或暂存当前工作，再执行：

```sh
git switch --detach baseline-before-preview
```

返回当前开发版本：

```sh
git switch main
```

这会切换项目文件；本地开发服务器也会随之显示对应版本。浏览器中的草稿保存在 localStorage，不属于 Git 版本记录。

早期流程改版验证：37 项测试通过、构建与类型检查通过；浏览器验证公众号与小红书切换、原稿展开、发布入口、真实文章导入（26 张配图）及 375px 布局。官方平台实际发布不在本次验证范围内。

最新公开代码以 `main` 提交记录为准；开发电脑另有不上传的本地交接与日志记录。

## 当前发布记录（2026-11-23）

- 功能版本：`e9fd646`，默认示例恢复“AI 工程五级进阶”；B站与抖音图片数据复制，准备进度、取消等待、超时与重试缓存。
- 验证：167项自动测试、类型与生产构建通过；用户确认逐个平台体验暂未发现问题，并明确授权上线。独立测试与用户反馈分别记录，不将其扩展为全部平台无损保证。
- Vercel生产部署：`dpl_25BJWUn9dbYhdLashETuWwFNoXdn`，状态READY；已核对正式域名 `prismpress-sigma.vercel.app` 指向该部署。
- 私有日志、交接、凭据、浏览器产物及用户演示视频不提交；只暂存明确列出的发布文件。后续文档提交可能改变分支HEAD，以上SHA标识本次功能版本。
