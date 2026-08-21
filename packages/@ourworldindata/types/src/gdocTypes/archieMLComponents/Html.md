Raw HTML escape hatch. The inner value is rendered as HTML, so this block
supports things that inline Google Docs formatting doesn't — such as
iframes or inline styling.

## When to use

- To embed external iframes (YouTube, third-party tools).
- For the very rare case where inline styling is needed and nothing else
  will do.

## When NOT to use

- Regular text styling — use Google Docs formatting (bold, italic, links,
  superscript / subscript) instead.
- Code samples to display verbatim — use `{.code}`.
- OWID charts — use `{.chart}` or `{.narrative-chart}`.

### Inline styled span

```archie
html: This is text that can use features like <span style="color:red">this will be red</span>.
```

### Iframe embed

```archie
html: <iframe src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
```
