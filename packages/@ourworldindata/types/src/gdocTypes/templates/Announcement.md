---
exemplars:
    - explore-updated-data-on-prison-populations-worldwide
    - hannah-ritchie-is-one-of-six-authors-shortlisted-for-the-2026-unwin-award
skeleton:
    - name: The news
      description:
          Two to five short paragraphs stating what changed and why it
          matters — a data update, a new feature, or organizational news.
          Nearly every published announcement is just prose at this length.
      components: [text]
    - name: Call to action
      description:
          One cta linking to the thing being announced — the updated charts,
          the new page, the external coverage. Almost every published
          announcement closes with one.
      components: [cta]
    - name: The image
      description:
          Optional single supporting image, usually wide with an outline —
          most commonly a screenshot of the updated chart or feature.
      components: [image]
---

A short site-news item: a data update, website upgrade, or organizational
announcement, published in the `/latest` feed under `/latest/{slug}` and
categorized there by its kicker.

## When to use

- Telling readers something changed on the site: refreshed data, a new
  feature, or news about the team or organization.

## When NOT to use

- Prefer `data-insight` for a chart-led observation about the data itself —
  an announcement points at what changed, it does not explain a pattern.
- Prefer `article` for any standalone narrative piece.

## Limitations

- A small variant of announcement has an empty body and a top-level `cta`
  front-matter property instead (used for the homepage announcement
  carousel). That nested `cta` structure is not yet supported by the
  ArchieML write-back — such documents must be edited in Google Docs
  directly. The write API refuses those edits rather than losing the
  content.
