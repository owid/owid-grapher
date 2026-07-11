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

## Notes

Unlike `{.aside}`, the paragraph the quote sits alongside must be
supplied as `content` inside the block — a CSS limitation.
