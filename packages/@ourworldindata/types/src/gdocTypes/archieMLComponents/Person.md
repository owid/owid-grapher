A single person card — image, name, optional title, optional link,
narrative bio text, and optional social links. Nested inside `{.people}`
(flat list) or `{.people-rows}` (column grid).

```archie
{.person}
image: Max Roser.jpeg
name: Professor Max Roser
title: Founder and Executive Co-Director
url: https://docs.google.com/document/d/1NfXOk8HVohVYjzJ1rtZYuw8h7kB9cWd5Kqxj4Dg1-WQ/edit
[.+text]
Max is the founder of Our World in Data and began working on this free online publication in 2011. Today, he serves as the publication’s editor and leads the team as its co-director. He is the Professor of Practice in Global Data Analytics at the University of Oxford’s Blavatnik School of Government, the Programme Director of the <a href="https://www.oxfordmartin.ox.ac.uk/global-development/">Oxford Martin Programme on Global Development</a>, and the Executive Co-Director of <a href="https://global-change-data-lab.org/">Global Change Data Lab</a>, the non-profit organization that publishes Our World in Data.
<i>For inquiries, please get in touch with Max’s Executive Assistant, Angela Wenham, at </i><i><a href="mailto:angela@ourworldindata.org">angela@ourworldindata.org</a></i><i>.</i>
[]
[.socials]
type: x
url: https://x.com/MaxCRoser
text: @MaxCRoser
type: bluesky
url: https://bsky.app/profile/maxroser.bsky.social
text: @maxroser.bsky.social
type: instagram
url: https://www.instagram.com/max.roser.owid/
text: max.roser.owid
type: threads
url: https://www.threads.net/@max.roser.owid
text: @max.roser.owid
type: linkedin
url: https://www.linkedin.com/in/max-roser-ox/
text: Max Roser
[]
{}
```

## When to use

- Inside `{.people-rows}` to populate a team / advisor / board grid.
- Inside `{.people}` for a flat list of cards.

## When NOT to use

- As a top-level block — `{.person}` is meant to be nested inside a
  collection.

## Notes

`image` is a filename uploaded via the admin. Point `url` at the
person's author-page gdoc when they have one. `socials` follows the same
format as `{.socials}` on author pages.
