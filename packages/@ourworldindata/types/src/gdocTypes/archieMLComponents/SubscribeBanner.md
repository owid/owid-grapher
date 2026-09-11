A small gray block inviting readers to subscribe. Added automatically to
every article and linear topic page; only include this block manually if
you want an additional copy inline.

```archie
{.subscribe-banner}
align: center
{}
```

## When to use

- Embedding a subscribe CTA inline within an article.

## When NOT to use

- The default subscribe banner is inserted automatically. To disable it
  on a specific article, set `hide-subscribe-banner: true` in the
  front-matter instead of using this block.

## Properties

- `align`: Where the banner sits: `center` (what you get when it is
  omitted) places it in the main text column; `left` or `right` place a
  narrower banner in the left or right margin column, letting text flow
  beside it. Any other value falls back to `center` and reports a parse
  error.

## Notes

The automatic banner is inserted immediately before the last h1. Place
one manually only when you want to control its position or alignment.
