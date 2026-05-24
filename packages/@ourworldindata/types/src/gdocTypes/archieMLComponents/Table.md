A simple table, built from a native Google Docs table wrapped in an
archie block. Three header templates are supported.

## When to use
- Small-to-medium tables that are best authored directly in Google Docs.

## When NOT to use
- For very large or complex tables, wrap a Google Docs table inside an
  `{.expander}` so it can be hidden by default.

## Variations
- `template`: `header-column` | `header-row` | `header-column-row`
- `size`: `narrow` | `wide` — defaults to spanning 6 columns; use `wide`
  for full width.
- `caption` is optional and supports rich text (including links).

Note: the actual `<table>` markup is authored directly in Google Docs; the
block wrapper only configures the template, size, and caption.

A `{.table}` block in archie only configures the wrapper (template, size,
caption); the actual rows come from a native Google Docs table placed
between the opening `{.table}` and closing `{}` inside the Gdoc. Because the
rows can't be expressed in pure ArchieML text, this component has no
standalone `@example`.
