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

## Publishing

Publishing (or updating a published document) happens from the document's
page in the admin and, alongside indexing it for search, enqueues a
static-site rebuild through the deploy queue — the change goes live once
that bake completes.
