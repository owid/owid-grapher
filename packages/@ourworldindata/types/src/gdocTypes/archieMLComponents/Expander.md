A rectangular box that conceals content until the reader clicks to reveal
it. Useful for large tables, technical detail, or optional methodology
that would otherwise interrupt the main narrative.

```archie
{.expander}
heading: Additional information
title: Which data sources and definitions do we rely on?
subtitle: Nunc tincidunt pharetra diam ut accumsan.
[.+content]
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
[]
{}
```

## When to use

- Hiding long technical descriptions behind a click.
- Wrapping a large table or dense methodology section.

## When NOT to use

- Prefer `{.expandable-paragraph}` for a short preview of inline text with
  a "Show more" link.

## Properties

- `heading`: A small label above the box, giving the reader context for
  what is hidden ("Additional information"). Omitted, no label is shown.
- `title`: The headline readers click to open the box. Required — without
  it the block is dropped and reported as a parse error.
- `subtitle`: Secondary text under the title, visible while the box is
  still closed. Omitted, nothing is shown there.
- `content`: The blocks revealed on click, authored as `[.+content]`. Only
  text, lists, headings, images, charts, tables and html are allowed
  inside; anything else is reported as a parse error.
