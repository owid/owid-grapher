A centered, italicized h1 used to re-emphasize a phrase from the surrounding
body text. The quote is visually set alongside a paragraph of `content`.

```archie
{.pull-quote}
quote: Just ten species — 0.15% of them — account for around 40% of wild mammal biomass.
align: left-center
[.+content]
We don’t have the counterfactual of what life would be like on a planet without us, but we can find a number of examples where our impact has been clear.
It’s possible to imagine a world where the biggest mammals would be even more dominant. Look at the average size of mammals over the last 50,000 years of human history, and we see an obvious trend: they’ve gotten smaller.8 This is for several reasons, but humans have played a crucial role.
[]
{}
```

## When to use

- Highlight a key phrase within an article to draw the reader's eye.

## When NOT to use

- Prefer `{.blockquote}` when citing an external source — pull quotes are
  meant to re-emphasize something from the article itself.

## Properties

- `content`: The body paragraph(s) the quote is set alongside, authored
  as a `[.+content]` freeform section. Unlike `{.aside}`, the paragraph
  must be supplied inside the block rather than placed next to it — a
  CSS limitation. Required, and only text paragraphs are allowed;
  anything else drops the block with a parse error.
- `align`: Where the quote sits relative to the content: `left` or
  `right` places it in the far margin column, `left-center` or
  `right-center` floats it against the text so the paragraph wraps
  around it. Required and must be one of these four values — otherwise
  the block is dropped with a parse error. On narrow screens all four
  render in the text column.
- `quote`: The highlighted phrase itself, written as plain text on one
  line — formatting is not rendered. Required; without it the block is
  dropped and reported as a parse error.
