---
exemplars:
    - saloni-dattani
skeleton:
    - name: Topics
      description: A pill row listing the topics the author writes about, in a
          single row (about 5–7 pills max on desktop).
      components: [pill-row]
    - name: Featured work
      description:
          A research-and-writing block with authors hidden on its cards, at
          least one primary and up to two secondary featured articles, plus
          an automatic "Latest work" section pulling the author's most
          recent articles (excluding anything already featured). No data
          insights or topics.
      components: [research-and-writing]
---

A profile page where an author showcases their work, generated from front
matter (name, role, bio, photo, socials) plus a body that follows one of
two layouts, chosen by how the author mostly contributes to the site.

## When to use

- Every author with a byline on the site gets one, so their name links to
  a page collecting their work.

## When NOT to use

- Not for one-off contributors — reserve it for people with an ongoing
  publishing role.

## Notes

The `title` field doubles as the lookup key for "Latest work": it must
match the author's name exactly as spelled in the `authors` field of
their articles.

## Variations

Authors whose work is mostly topic pages use a single-section "topic
focus" layout instead of the two sections above: one `{.research-and-writing}`
block titled "All work", secondary links only (no primary section, no
automatic latest section, no data insights), kept up to date by hand
from `/admin/api/all-work?author=<name>`. Topic pages belong here — the
no-topics rule applies only to the article-focus "Featured work" block
above, which lists topic pills instead.
