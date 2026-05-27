A rectangular box that conceals content until the reader clicks to reveal
it. Useful for large tables, technical detail, or optional methodology
that would otherwise interrupt the main narrative.

## When to use

- Hiding long technical descriptions behind a click.
- Wrapping a large table or dense methodology section.

## When NOT to use

- Prefer `{.expandable-paragraph}` for a short preview of inline text with
  a "Show more" link.

## Variations

- `heading` is optional context above the box.
- `title` is the clickable headline.
- `subtitle` is optional secondary text.

### Technical detail expander

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
