A single person card — image, name, optional title, optional link,
narrative bio text, and optional social links. Nested inside `{.people}`
(flat list) or `{.people-rows}` (column grid).

## When to use

- Inside `{.people-rows}` to populate a team / advisor / board grid.
- Inside `{.people}` for a flat list of cards.

## When NOT to use

- As a top-level block — `{.person}` is meant to be nested inside a
  collection.

## Variations

- `image` (optional): asset filename to display.
- `name` (required): the person's name.
- `title` (optional): role / job title shown under the name.
- `url` (optional): link wrapping the card.
- `text` (required): one or more paragraphs of bio / description.
- `socials` (optional): array of social links. Each has `type` (e.g. `x`,
  `mastodon`, `bluesky`, `threads`), `url`, and `text` (display label).

```archie
{.person}
image: Max Roser.jpeg
name: Max Roser
title: Founder and Executive Co-Director
url: https://ourworldindata.org/team/max-roser
[.+text]
Max is the founder of Our World in Data and an Associate Professor at the
University of Oxford.
[]
[.socials]
type: x
url: https://x.com/MaxCRoser
text: @MaxCRoser
[]
{}
```
