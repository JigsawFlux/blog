# JigsawFlux Blog

The source for the [JigsawFlux Blog](https://jigsawflux.org/blog/) — updates and insights from the JigsawFlux open-source community covering health tech, crisis management, and humanitarian tools.

Built with [Docusaurus 3.5](https://docusaurus.io/).

## Local Development

```bash
npm install
npm start        # http://localhost:3000/blog/
```

## Adding a Post

Create a directory under `blog/` following the naming convention `YYYY-MM-DD-slug/` with an `index.md` file:

```yaml
---
slug: your-url-slug
title: Your Post Title
date: YYYY-MM-DD
authors: [suresh]
tags: [tag1, tag2]
description: One-sentence summary for feeds and meta tags.
---

Intro paragraph shown in the post list.

<!-- truncate -->

Full post content here.
```

Place any images in the same directory and reference them with relative paths.

## Deployment

Pushing to `main` automatically builds and deploys to [jigsawflux.github.io/blog](https://jigsawflux.org/blog/) via GitHub Actions.
