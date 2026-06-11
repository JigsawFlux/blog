# Draft Log — ai-credits-optimization

Tracking each iteration: model used, task, and token cost from `/usage` in Claude Code.

## Session 1 — Structural work

Heavy lifting: converting raw strategy doc → structured blog post, tone rewrite, publishing setup.

| Iteration | Model             | Task                                              | Cost   |
|-----------|-------------------|---------------------------------------------------|--------|
| 0         | claude-sonnet-4-6 | Frontmatter, CLAUDE.md setup, draft log scaffolding | —    |
| 1         | claude-sonnet-4-6 | Full structural rewrite — enterprise doc → first-person blog | — |
| Subagent  | claude-haiku-4-5  | Read-only codebase lookup (existing blog tone analysis) | $0.02 |
| **Total** | | 1.5k input · 18k output · 1.6m cache read | **$1.30** |

## Session 2 — Prose polish + non-profit section

Narrative refinement, non-profit cost alternatives section, appendix with real usage data.

| Iteration | Model             | Task                                              | Cost   |
|-----------|-------------------|---------------------------------------------------|--------|
| 2         | claude-sonnet-4-6 | Prose polish, narrative structure, section transitions | —  |
| 3         | claude-sonnet-4-6 | Non-profit section, cost alternatives, appendix   | —      |
| **Total** | | 0.7k input · 11.1k output · 1.0m cache read (delta) | **~$0.56** |

## Session 3 — Narrative pass (Fable 5)

Light editorial pass after switching to `claude-fable-5`: metaphor consistency (sledgehammer vs Formula 1), sentence rhythm, appendix restructure into three sessions.

| Iteration | Model           | Task                                              | Cost   |
|-----------|-----------------|---------------------------------------------------|--------|
| 4         | claude-fable-5  | Editorial polish — metaphor consistency, rhythm, voice | $2.25 |
| **Total** | | 645 input · 5.1k output · 495.2k cache read · 74.7k cache write | **~$2.40** (incl. ~$0.15 Sonnet residual) |

**Key finding:** the smallest session was the most expensive. Fable 5 produced only 5.1k output tokens
(vs Sonnet's 31.4k across Sessions 1–2) but cost $2.25 vs Sonnet's $2.01 — premium per-token pricing
dominated token volume.

## Cumulative session total

| Model             | Input  | Output | Cache read | Cache write | Cost    |
|-------------------|--------|--------|------------|-------------|---------|
| claude-sonnet-4-6 | 2.5k   | 31.4k  | 2.9m       | 112.3k      | $2.01   |
| claude-fable-5    | 645    | 5.1k   | 495.2k     | 74.7k       | $2.25   |
| claude-haiku-4-5  | 1.0k   | 877    | 7.5k       | 10.5k       | $0.02   |
| **Total**         |        |        |            |             | **$4.28** |

*API duration: 11m 52s · Wall time: 1h 9m 39s · Code changes: 321 lines added, 180 removed*

## Notes

- Sessions 1–2 ran on Sonnet (early `/model` attempts had typos); Session 3 ran on Fable 5 after the switch took effect
- Fable 5's per-token premium meant the lightest edit pass cost more than the entire structural rewrite — a live demonstration of the post's thesis that model choice dominates cost
- `/init` skill accounted for ~12% of session usage (CLAUDE.md setup at start of session)
- Explore subagent (Haiku) accounted for ~1% of session usage
