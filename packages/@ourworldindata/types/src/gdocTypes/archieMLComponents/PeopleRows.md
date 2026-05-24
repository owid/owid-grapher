A grid of `{.person}` cards, used on about pages to present team
members. Wraps an inner `[.+people]` list of people blocks.

## When to use
- On about pages (`type: about-page`) to list team, board, or
  advisors.

## When NOT to use
- Elsewhere.

## Variations
- `columns`: `2` or `4` — 4 suits compact cards, 2 suits cards with
  longer bios.

### Two-column row

```archie
{.people-rows}
columns: 2

[.+people]
{.person}
image: Max Roser.jpeg
name: Professor Max Roser
title: Founder and Executive Co-Director
url: https://docs.google.com/document/d/1NfXOk8HVohVYjzJ1rtZYuw8h7kB9cWd5Kqxj4Dg1-WQ/edit
[.+text]
Max is the founder of Our World in Data.
[]
[.socials]
type: x
url: https://x.com/MaxCRoser
text: @MaxCRoser
[]
{}
[]
{}
```
