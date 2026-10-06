---
decision: none
---

A wrapper that includes or excludes its inner content based on the
current rendering context (for example the current entity on a
country profile page). Undocumented in the author reference.

## Properties

- `include`: A comma-separated list of country or region names (e.g.
  `include: Europe, South America`). The section is shown only when the
  page's current country is one of the entries or belongs to one of the
  listed regions. Omitted, every country is included (subject to
  `exclude`) — but at least one of `include`/`exclude` must be given, or
  the block is reported as a parse error.
- `exclude`: A comma-separated list of country or region names for which
  to hide the section. When both lists are given they must not overlap,
  the include list must consist of regions (not individual countries),
  and every excluded entry must fall inside an included region —
  violations are reported as parse errors.
- `content`: The blocks to show or hide, authored as a `[.+content]`
  freeform section — any blocks are allowed. Required; without it the
  block is dropped and reported as a parse error.
