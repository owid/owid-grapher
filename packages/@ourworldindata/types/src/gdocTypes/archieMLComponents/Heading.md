A section heading. Authored via Google Docs text styles (Heading 1,
Heading 2, Heading 3) — the level is derived from the docs style. Start
sections with h1; nest with h2, then h3.

## Properties

- `text`: The heading's rich text — Docs formatting like italics
  survives. Comes from the text of the styled heading line; a heading
  with no text is dropped and reported as a parse error.
- `supertitle`: A small all-caps label rendered above the heading title
  (used on the SDG pages). Authored by putting a soft line break
  (Shift+Enter) inside the heading: the line before the break becomes
  the supertitle, the line after it the title. Only h2 and h3 headings
  render it; omitted, the heading is just its title.
- `level`: Not written as a key — derived from the Google Docs heading
  style, so "Heading 1" becomes an h1 on the page, down to "Heading 5"
  (rendered as a small all-caps overline). Levels outside 1–5 drop the
  block with a parse error.
