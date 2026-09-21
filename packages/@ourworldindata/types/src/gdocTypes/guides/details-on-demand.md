---
title: Details on demand
category: Writing
---

A detail on demand (DoD) is a definition popup attached to a phrase,
keyed by an id.

## In a document

Link the phrase to `#dod:your_id` using Google Docs' link tool — the id
is whatever follows `#dod:`. That link becomes an anchor in the
ArchieML the document produces, not something you type by hand:

```archie
Details on demand let you define <a href="#dod:primaryenergy">primary energy</a> once and reuse it across the site.
```

## In chart subtitles and footers

Grapher and explorer subtitles and footers use markdown instead of a
Docs link, e.g. `[Primary energy](#dod:primaryenergy)`.

## Where the definitions live

Definitions are not authored inside the document itself: each DoD is a
row in the `dods` database table, managed at /admin/dods, and every
document's `details` dictionary is populated from that table at
render/bake time.

## Notes

A DoD is a popup attached to a phrase; a ref (`{guide:refs}`) is a
footnote collected at the end of the page. Use a DoD for a definition
the reader can look up inline, a ref for a source.
