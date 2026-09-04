---
decision: none
---

A plain-text fragment without any inline formatting (no bold, italics,
or links). Used as an internal primitive for blocks whose text must be
flat — for example, inside `{.code}` — and is not authored directly in
ArchieML.

## Properties

- `value`: The plain text itself. Not authored — code fills it when a
  parent block needs unformatted text; any Google Docs formatting or
  links in the source text are dropped.
