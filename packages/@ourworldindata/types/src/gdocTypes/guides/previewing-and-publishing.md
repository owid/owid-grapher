---
title: Previewing and publishing
category: Publishing
---

How a Google Doc becomes a page.

## Previewing

Preview a document at
`https://admin.owid.io/admin/gdocs/<GDOC_ID>/preview`, where `GDOC_ID` is
the long segment of the document's own Google Docs URL (the part after
`/document/d/`). The document must already be registered at /admin/gdocs
for this to work — see `{guide:linking}`.

## Data insights

Data insights are drafted from the
[Data Insight default GDoc template](https://docs.google.com/document/d/1R_0rPmbofVnNrFUUUtqPvWCLypOzG_AqVJHSq99x3IA/edit)
and stored on Drive in
[this folder](https://drive.google.com/drive/u/0/folders/1tImR6L-viqlABvPVw_5nUez9CVYag5el).
The image is square, 2160px wide, exported from the chart's export tab,
and referenced with an `{.image}` block. See `{template:data-insight}`.

## Publishing

Publishing (or updating a published document) happens from the document's
page in the admin and, alongside indexing it for search, enqueues a
static-site rebuild through the deploy queue — the change goes live once
that bake completes.
