A small gray-background block used to draw attention to meta-textual
information — e.g. "data was last updated", caveats about methodology,
or short editorial notes.

## When to use
- Flagging data freshness, caveats, or other meta-textual notes.
- Short side notes that should stand out from the main body.

## When NOT to use
- Prefer `{.aside}` for a plaintext caption placed to the side of a
  paragraph.
- Prefer `{.data-callout}` when interpolating live chart data.

## Variations
- `title` is optional.
- `icon` is optional; only the `info` icon is supported.
- The text block can contain paragraphs, headings, and lists.

If placed inside a key insight, make the first line (e.g. "What you should
know about this data") an h5 so the correct CSS applies.

### With title and info icon

```archie
{.callout}
title: Update
icon: info
[.+text]
This article uses data from 2020

But the conclusions are solid.

[]
{}
```
