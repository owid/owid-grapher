A grid of `{.person}` cards, used on about pages to present team
members. Wraps an inner `[.+people]` list of people blocks.

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

## When to use

- On about pages (`type: about-page`) to list team, board, or
  advisors.

## When NOT to use

- Elsewhere.

## Notes

Four columns suit compact cards; two suit cards with longer bios. Fewer
columns render on smaller screens either way.
