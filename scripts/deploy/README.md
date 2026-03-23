# Custom domain (askqadi.org) → GitHub Pages

This repo is a **project site**: default URL is `https://<owner>.github.io/askyq/`. With a custom apex domain, GitHub serves the site at `https://askqadi.org/` (no `/askyq` path).

## 1. Registrar

At your domain registrar, set **nameservers** to the four NS values from the Route 53 hosted zone for `askqadi.org` (your console already shows them).

## 2. Route 53 records (programmatic)

Requires the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) on your `PATH` (the script runs `aws`, not boto3). On macOS: `brew install awscli`. Then configure credentials (`aws sts get-caller-identity` should succeed). If the binary lives elsewhere, set `AWS_BIN=/full/path/to/aws`.

```bash
cd /path/to/askyq
chmod +x scripts/deploy/route53_github_pages.py
./scripts/deploy/route53_github_pages.py
```

Optional environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `DOMAIN` | `askqadi.org` | Apex domain |
| `HOSTED_ZONE_ID` | (auto) | Route 53 zone id if auto-detect fails |
| `GITHUB_PAGES_TARGET` | `abidlabs.github.io` | CNAME target for `www` (see below) |
| `AWS_BIN` | (search `PATH`) | Path to `aws` if not on `PATH` |

If GitHub Pages is served from **your fork** (`youruser.github.io/askyq`), set:

`GITHUB_PAGES_TARGET=youruser.github.io`

## 3. GitHub: custom domain + HTTPS

Use a GitHub account that has **admin** on `abidlabs/askyq` (`gh auth login`). If `PATCH .../pages` returned **404**, GitHub Pages was not enabled yet; `github_pages_set_domain.sh` now **creates** a legacy Pages site (deploy from branch `main`, `/`) then sets the custom domain.

If you still get **404**, the authenticated user cannot access that API (wrong account or no org permission). If you use **GitHub Actions** for Pages instead of branch deploy, create the site from the UI once, then run the script again.

With [GitHub CLI](https://cli.github.com/):

```bash
chmod +x scripts/deploy/github_pages_set_domain.sh
GITHUB_OWNER=abidlabs GITHUB_REPO=askyq CUSTOM_DOMAIN=askqadi.org ./scripts/deploy/github_pages_set_domain.sh
```

Optional: `GITHUB_PAGES_BRANCH=main` if your default branch differs.

Or in the UI: **Settings → Pages → Custom domain** → `askqadi.org` → Save. After DNS propagates, enable **Enforce HTTPS**.

GitHub recommends adding the domain in the repo **before** or as you publish DNS, to reduce takeover risk.

## 4. Site build

`scripts/build.js` uses `SITE_URL` (default `https://askqadi.org`) for canonical URLs, sitemap, and RSS. It writes a root `CNAME` file for branch-based Pages. Rebuild and push:

```bash
export SITE_URL=https://askqadi.org
node scripts/build.js
```

## 5. Verify

```bash
dig askqadi.org +short -t A
dig www.askqadi.org +short -t CNAME
```

A records should match GitHub’s [documented IPs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#configuring-an-apex-domain).
