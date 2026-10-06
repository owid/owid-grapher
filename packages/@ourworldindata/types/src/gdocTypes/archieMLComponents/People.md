A flat list of `{.person}` items — distinct from `{.people-rows}` which
arranges them in a configurable column grid. `{.people}` is a bare
container, leaving layout to the parent context.

## When to use

- When you need a sequence of person cards without the explicit row/column
  grid layout of `{.people-rows}`.
- As an intermediate structure when downstream rendering will handle
  layout (e.g. embedded in a custom section).

## When NOT to use

- For a standard team or board grid with 2- or 4-column layout — use
  `{.people-rows}` instead.

## Properties

- `items`: The person cards — the block itself is the list, authored as
  `[.people]` … `[]` containing `{.person}` blocks (see `{.person}` for
  the fields available on each). The cards render in a single column,
  in document order. Writing anything other than a list here drops the
  block with a parse error.

## Notes

This block has no current usage in the content repo and no canonical
archie example. Reach for `{.people-rows}` instead for new content.
