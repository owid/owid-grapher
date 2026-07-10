A centered, italicized h1 used to re-emphasize a phrase from the surrounding
body text. The quote is visually set alongside a paragraph of `content`.

### Left-center aligned

```archie
{.pull-quote}
quote: I am a left-center aligned quote that should span multiple lines.
align: left-center
[.+content]
Suspendisse commodo turpis nunc, sit amet cursus odio porttitor scelerisque.
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
