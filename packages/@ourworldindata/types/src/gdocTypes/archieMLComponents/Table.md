A simple table, built from a native Google Docs table wrapped in an
archie block. Three header templates are supported.

## When to use

- Small-to-medium tables that are best authored directly in Google Docs.

## When NOT to use

- For very large or complex tables, wrap a Google Docs table inside an
  `{.expander}` so it can be hidden by default.

## Notes

The rows come from a native Google Docs table placed between the opening
`{.table}` and closing `{}` — the archie block only configures the
wrapper (template, size, caption). Because the rows can't be expressed
in pure ArchieML text, this component has no standalone `@example`.

The templates control which edge of the table is the header. Tables span
6 columns; `size: wide` makes them full-width.
