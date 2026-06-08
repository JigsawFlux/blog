# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **JigsawFlux Blog** — a Docusaurus 3.5 static site published at `https://jigsawflux.org/blog/`. The site is blog-only (docs plugin is disabled); the blog index is served at the root path (`/`).

## Commands

```bash
npm start          # dev server at http://localhost:3000/blog/
npm run build      # production build to ./build/
npm run serve      # serve the production build locally
npm run clear      # clear Docusaurus cache (use when hot reload breaks)
```

No test suite. No linter configured.

## Deployment

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`), which builds the site and deploys to the `JigsawFlux/jigsawflux.github.io` repo under the `blog/` directory using a `DEPLOY_TOKEN` secret.

## Content Structure

Each blog post lives in its own directory under `blog/`:

```
blog/YYYY-MM-DD-slug/
  index.md          # post content
  *.png / *.jpg     # images referenced in the post
```

**Required frontmatter** for every post:

```yaml
---
slug: url-slug
title: Post Title
date: YYYY-MM-DD
authors: [suresh]
tags: [tag1, tag2]
description: One-sentence summary used in feeds and meta tags.
---
```

Use `<!-- truncate -->` to mark the fold for the blog list preview.

The only defined author is `suresh` (see `blog/authors.yml`). Add new authors there before referencing them in frontmatter.

## Features in Use

- **Mermaid diagrams** — enabled via `@docusaurus/theme-mermaid`; use fenced ` ```mermaid ` blocks directly in Markdown
- **MDX** — posts support JSX/React components if needed
- **RSS/Atom feeds** — auto-generated; don't break frontmatter `description` fields
