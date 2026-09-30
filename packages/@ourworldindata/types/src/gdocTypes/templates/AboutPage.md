---
exemplars:
    - about
skeleton:
    - name: Sections
      repeats: true
      description: About pages behave like normal articles, built from headings,
          prose and images, but with dedicated spacing and typography and a
          shared about-section sub-navigation.
      components: [heading, text, image]
    - name: Team
      description: A list of people — team members, former team members, board
          members — optionally wrapped in a `{.people-rows}` block to lay
          them out in 2 or 4 columns.
      components: [people, people-rows, person]
    - name: Donors
      description:
          An empty `{.donors}` block that marks where the database-backed
          list of donors is inserted.
      components: [donors]
---

The pages presenting Our World in Data itself — the organization, funding,
jobs, FAQs and policies — under the `/about` sub-navigation, whose main page
is `/about`. Published under `/{slug}`.

## When to use

- Any page that belongs in the about-section sub-navigation rather than the
  topic content of the site.

## When NOT to use

- Prefer `{template:article}` or `{template:topic-page}` for content about the world, not about
  the organization.

## Notes

`{.donors}`, `{.people}`, `{.people-rows}` and `{.person}` are dedicated
about-page components, not expected to be used on other document types.
