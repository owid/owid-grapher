---
decision: none
---

A country selector UI used on country-profile pages to let readers
jump to a specific country's profile. Undocumented in the author
reference.

## Properties

- `url`: The Google Doc URL of the country profile whose per-country
  pages the selector links to; the list of searchable countries comes
  from that profile's available countries. Required; without it the
  block is reported as a parse error and doesn't render.
- `title`: The heading next to the search panel. Omitted, "Country
  Profiles" is shown.
- `description`: Text under the heading. Omitted, "Browse country-level
  data and insights." is shown.
- `defaultCountries`: The countries shown before the reader types a
  search, as a single comma-separated line of country names
  (`defaultCountries: France, Japan, Kenya`). Omitted, a default set is
  shown (United Kingdom, United States, China, Nigeria, India, Brazil).
