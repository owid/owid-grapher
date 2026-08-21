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
