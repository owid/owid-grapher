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

## Variations

- `items` is an array of `{.person}` blocks. See `{.person}` for the
  fields available on each.

Note: this block has no current usage in the content repo and no canonical
archie example. Reach for `{.people-rows}` instead for new content.
