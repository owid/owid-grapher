Aligns a block of text horizontally. Affects text only — images, charts,
and other visual blocks are not re-aligned by this wrapper.

```archie
{.align}
alignment: center
[.+content]
{.heading}
text: The 17 Sustainable Development Goals
level: 2
{}
{.heading}
text: Click on a Goal below to see interactive charts for available indicators
level: 3
{}
[]
{}
```

## When to use

- To center or right-align a heading or short paragraph inline with prose.

## When NOT to use

- To align images, charts, or other visual blocks — those blocks have their
  own size/visibility controls.
- For full-width styled sections; prefer `{.gray-section}`.

## Properties

- `alignment`: How to align the text: `left`, `center` or `right`.
  Required — if it is missing or any other value, the block is dropped
  and reported as a parse error.
- `content`: The blocks to align, authored as a `[.+content]` freeform
  section. Only text is re-aligned — images, charts, and other visual
  blocks inside are unaffected. Required; without it the block is dropped
  and reported as a parse error.
