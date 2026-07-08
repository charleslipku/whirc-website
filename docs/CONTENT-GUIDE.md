# WHIRC 网站内容编辑手册（一页纸）

> 面向所有团队成员。无需安装任何软件——直接在 GitHub 网页上编辑，
> 保存（Commit）后 1–2 分钟网站自动更新。

## 在哪里改什么

| 想做的事 | 编辑的文件/目录 |
|---------|----------------|
| 发一条 WHIRC 新闻 | `src/content/news/` 新建 `.md` 文件 |
| 添加/修改团队成员 | `src/content/people/` 每人一个 `.md` |
| 添加活动 | `src/content/events/` 新建 `.md` |
| 修改 About / Research / Get Involved 正文 | `src/content/pages/` 对应 `.md` |
| 修改联系方式、社交链接 | `src/content/config/site.yaml` |
| **修改新闻抓取关键词** | `src/content/config/news-tags.yaml` |
| 上传图片 | `public/images/` 对应子目录 |

## 操作步骤（以发新闻为例）

1. 打开仓库 → `src/content/news/` → **Add file → Create new file**
2. 文件名格式：`2026-09-01-kickoff-symposium.md`
3. 粘贴以下模板并修改：

```markdown
---
title: "WHIRC Kickoff Symposium Announced"
date: 2026-09-01
excerpt: "一句话摘要，显示在新闻卡片上"
image: /images/news/kickoff.jpg   # 可选
---

正文支持完整 Markdown：**加粗**、[链接](https://...)、列表、图片等。

![图片说明](/images/news/photo.jpg)
```

4. 页面底部点 **Commit changes** → 完成

> **图片**：先到 `public/images/news/` 用 **Add file → Upload files** 上传，
> 再在 Markdown 中以 `/images/news/文件名` 引用。
> **视频**：推荐上传到 YouTube 后在正文中贴链接。

## 添加团队成员模板

```markdown
---
name: "Jane Doe"
role: "Affiliated Faculty"          # 显示在名字上方的小标签
title: "Assistant Professor, Kinesiology"
school: "School of Public Health"
photo: /images/people/jane-doe.jpg
website: https://sph.umd.edu/people/jane-doe
group: faculty                       # leadership | faculty | students
order: 10                            # 组内排序，数字小的在前
---
```

## 修改新闻抓取关键词

编辑 `src/content/config/news-tags.yaml`：

- `include:` 下加一行 `- "新关键词"` → 命中即收录
- `exclude:` 下加关键词 → 命中即剔除（处理误报）
- 保存后次日自动生效；如需立即生效：仓库 **Actions → Fetch UMD News → Run workflow**
