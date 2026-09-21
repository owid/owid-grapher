A simple table, built from a native Google Docs table wrapped in an
archie block. Three header templates are supported.

## When to use

- Small-to-medium tables that are best authored directly in Google Docs.

## When NOT to use

- For very large or complex tables, wrap a Google Docs table inside an
  `{.expander}` so it can be hidden by default.

## Properties

- `template`: Which edge of the table is styled as the header:
  `header-row` (the first row; what you get when it is omitted),
  `header-column` (the first column), or `header-column-row` (both).
  Any other value drops the table and reports a parse error.
- `size`: `narrow` (the default) keeps the table at text-column width;
  `wide` stretches it across the full content width. Any other value
  drops the table and reports a parse error.
- `rows`: Not written by hand — place a native Google Docs table between
  the opening `{.table}` and the closing `{}`, and its rows become the
  table. Cells keep rich text: formatting, links, and lists survive. A
  `{.table}` block without a Docs table is dropped and reported as a
  parse error.
- `caption`: A caption shown in small italic text below the table. Rich
  text — formatting and links survive. Omitted, no caption is shown.

## Notes

Because the rows come from a native Google Docs table and can't be
expressed in pure ArchieML text, this component has no standalone
`@example`.
