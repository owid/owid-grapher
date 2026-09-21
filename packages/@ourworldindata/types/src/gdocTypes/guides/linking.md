---
title: Linking to documents
category: Writing
---

Link to one of our own documents with its Google Docs URL rather than its
ourworldindata.org URL. The admin resolves the Docs URL to the document's
published slug at render time, so the link survives slug changes.

## In prose

Paste the Google Docs link directly into the text, or use Google Docs'
own "Insert Link" dialogue to search for the document.

## In components

Components that link to a document take the same Google Docs URL in a
`url` property — for example `{.prominent-link}`:

```archie
{.prominent-link}
url: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk
{}
```

## When it does not resolve

The link only resolves once the target document is registered in the
admin at /admin/gdocs. If the target document is registered but not yet
published, the admin flags the link as a warning until it is. A link to
an external, non-gdoc URL needs its own link text (or, for a component, its
own `title`) since there's no document to fetch one from.

## Notes

Legacy ourworldindata.org URLs still work, but they point at a fixed
path and won't follow the target if its slug changes later.
