Raw HTML escape hatch. The inner value is rendered as HTML, so this block
supports things that inline Google Docs formatting doesn't — such as
iframes or inline styling.

```archie
html: This is text that can use features like <span style="color:red">this will be red</span>.
```

```archie
html: <iframe width="628" height="353" src="https://www.youtube.com/embed/RCz6EIcSFQ8?si=FP1FgyksWgAdSmLs" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
:end
```

## When to use

- To embed external iframes (YouTube, third-party tools).
- For the very rare case where inline styling is needed and nothing else
  will do.

## When NOT to use

- Regular text styling — use Google Docs formatting (bold, italic, links,
  superscript / subscript) instead.
- Code samples to display verbatim — use `{.code}`.
- OWID charts — use `{.chart}` or `{.narrative-chart}`.

## Notes

Inline HTML written directly in body text is not parsed — anything
beyond Google Docs formatting has to go through this block.
