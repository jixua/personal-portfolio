---
name: deploy-production
description: Publish this personal-portfolio project to production. Use when the user asks to deploy, publish online, release to the server, update www.jixu.ink, or run the production deployment workflow for this repository.
---

# Deploy Production

Use this skill only inside the `personal-portfolio` repository.

## Target

- Server: `root@8.153.147.78`
- App directory: `/opt/personal-portfolio`
- Node service: `personal-portfolio`
- Public domain: `www.jixu.ink`
- App port: `31001`
- Nginx proxies `www.jixu.ink` to `127.0.0.1:31001`

## Required Workflow

1. Inspect the local working tree.

```bash
git status --short --branch
```

2. If there are local code changes that should ship, run validation before committing.

```bash
npm run lint
```

3. Commit and push the intended changes to `origin/main`.

```bash
git add <changed-files>
git commit -m "<clear release message>"
git push origin main
```

4. Deploy from the local machine with the bundled script.

```bash
./scripts/deploy-server.sh
```

The script builds locally, uploads `dist`, `package.json`, and `package-lock.json`, installs production dependencies on the server, switches the `current` symlink, restarts `personal-portfolio`, reloads Nginx, and keeps the latest 5 releases.

5. Verify the remote service.

```bash
ssh -i ~/.ssh/codex_remote -o IdentitiesOnly=yes root@8.153.147.78 \
  'systemctl is-active personal-portfolio && curl -I --max-time 10 http://127.0.0.1:31001/'
```

If Nginx or DNS behavior is relevant, also verify:

```bash
ssh -i ~/.ssh/codex_remote -o IdentitiesOnly=yes root@8.153.147.78 \
  'nginx -t && systemctl is-active nginx'
```

## Safety Notes

- Do not commit `.env`, SQLite data, uploaded user files, server passwords, or Aliyun AccessKey secrets.
- If deployment fails after creating a new release, inspect `journalctl -u personal-portfolio -n 80 --no-pager` on the server before retrying.
- Prefer fixing the local source and redeploying rather than editing files directly inside `/opt/personal-portfolio/current`.
