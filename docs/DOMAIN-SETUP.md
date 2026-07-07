# 自定义域名迁移指南：womenshealth.umd.edu

目标：把 `https://www.ang-li.com/whirc-website/` 迁移到 `https://womenshealth.umd.edu`。
整个过程零停机，旧地址会自动 301 跳转到新域名。

## 流程总览（三方各做什么）

| 步骤 | 谁来做 | 做什么 |
|------|--------|--------|
| 1 | **Ang Li（向 DIT 申请）** | 申请子域名 + 2 条 DNS 记录 |
| 2 | **GitHub 仓库设置** | 填写 Custom domain，等证书签发 |
| 3 | **代码侧（一次提交）** | 改 site/base 配置 + 内容里的路径前缀 |

---

## 第 1 步：向 UMD DIT 申请 DNS（唯一需要学校操作的环节）

通过 [itsupport.umd.edu](https://itsupport.umd.edu) 提交服务请求（服务目录里一般叫
**DNS / Domain Name Request** 或 **Web Hosting → Custom Domain**）。子域名申请
通常需要说明用途，并由教职工/部门赞助（PI 身份即可）。

**请求 DIT 添加两条记录：**

```
1) CNAME 记录（域名指向）
   womenshealth.umd.edu  →  charleslipku.github.io

2) TXT 记录（GitHub 域名所有权验证，防止域名被他人抢注绑定）
   _github-pages-challenge-charleslipku.womenshealth.umd.edu  →  <验证码>
```

> TXT 记录的验证码获取方式：GitHub 个人 Settings → Pages →
> **Add a verified domain** → 输入 `womenshealth.umd.edu`，页面会给出
> 具体的 TXT 记录名和值。**建议在提交 DIT 工单前先做这一步**，
> 两条记录一次性申请，避免来回跑流程。

**申请邮件/工单模板（英文）：**

> Subject: DNS record request for womenshealth.umd.edu (Grand Challenges project website)
>
> Hello, I am Ang Li, Assistant Professor in ECE and a Principal Investigator of the
> Women's Health Interdisciplinary Research Collaborative (WHIRC), a UMD Grand
> Challenges Institutional Grant project
> (https://research.umd.edu/grand-challenges-grants/grand-challenges-2/institutional-grants-2.0/whirc).
>
> We request the subdomain **womenshealth.umd.edu** for the project's public website,
> currently hosted on GitHub Pages. Please create:
>
> 1. CNAME: womenshealth.umd.edu → charleslipku.github.io
> 2. TXT: _github-pages-challenge-charleslipku.womenshealth.umd.edu → "<code>"
>
> The site is a static website served over HTTPS (certificate auto-provisioned by
> GitHub Pages via Let's Encrypt once the CNAME is live). It follows UMD brand
> guidelines and WCAG 2.1 AA accessibility practices. Happy to provide any
> additional information needed.

注意：DIT 可能要求内容/无障碍审核，或要求域名由部门单位（而非个人）担保；
若被问及托管方式，说明是 GitHub Pages 静态站点、无服务器端组件即可。

---

## 第 2 步：GitHub 仓库设置（DNS 生效后，5 分钟）

1. 打开 <https://github.com/charleslipku/whirc-website/settings/pages>
2. **Custom domain** 填 `womenshealth.umd.edu` → Save
   （GitHub 会做 DNS check，CNAME 未生效时会报错，等 DNS 传播后重试）
3. 等待 HTTPS 证书自动签发（通常几分钟～1 小时）
4. 勾选 **Enforce HTTPS**

---

## 第 3 步：代码侧切换（一次提交，可请 Claude 代做）

**3a. `astro.config.mjs`：**

```js
export default defineConfig({
  site: 'https://womenshealth.umd.edu',
  base: '/',                              // 原为 '/whirc-website'
  trailingSlash: 'ignore',
});
```

**3b. 内容文件里写死的 `/whirc-website/` 前缀**（people 照片、markdown 内链）：

```bash
grep -rl "/whirc-website/" src/content/ docs/CONTENT-GUIDE.md | \
  xargs sed -i '' 's|/whirc-website/|/|g'
```

**3c. 提交推送**，Actions 自动重新构建部署。

**3d. 验证清单：**

- [ ] https://womenshealth.umd.edu 首页正常、样式/图片无 404
- [ ] 旧地址 `www.ang-li.com/whirc-website/` 自动 301 到新域名
- [ ] HTTPS 锁标志正常（Enforce HTTPS 已勾选）
- [ ] News 页、People 照片、Hero 轮播图正常
- [ ] `docs/CONTENT-GUIDE.md` 中图片路径示例已同步更新（3b 已覆盖）

---

## 常见问题

- **迁移期间网站会挂吗？** 不会。旧地址在整个过程中持续可用，直到第 3 步
  部署完成后自动跳转到新域名。
- **为什么 CNAME 指向 charleslipku.github.io 而不是仓库名？**
  GitHub Pages 按 HTTP Host 头路由，用户名.github.io 是统一入口，
  仓库级 Custom domain 设置决定哪个仓库响应该域名。
- **和 www.ang-li.com 冲突吗？** 不冲突。那是账号级用户站点的域名，
  本仓库（项目站点）可以独立绑定自己的域名。
- **以后换托管（如学校服务器）怎么办？** 内容全是静态文件 + Markdown，
  `npm run build` 的 `dist/` 目录拷到任何静态服务器即可，DNS 改指向就行。
