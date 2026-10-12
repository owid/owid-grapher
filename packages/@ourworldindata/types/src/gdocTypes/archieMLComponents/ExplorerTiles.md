A grid of tiles linking to data explorers. Typically shown on the
homepage. Each tile pulls its icon from the explorer's tag in admin.

```archie
{.explorer-tiles}
title: Data explorers
subtitle: Interactive visualization tools to explore a wide range of related indicators.
[.explorers]
url: https://ourworldindata.org/explorers/poverty-explorer
url: https://ourworldindata.org/explorers/population-and-demography
url: https://ourworldindata.org/explorers/global-health
url: https://ourworldindata.org/explorers/energy
[]
{}
```

## When to use

- On the homepage to feature OWID data explorers.

## When NOT to use

- For a single explorer embed — use `{.chart}` with the explorer URL.

## Properties

- `title`: The heading above the grid. Required; without it the block
  is dropped and reported as a parse error.
- `subtitle`: Text under the heading. Required; without it the block is
  dropped and reported as a parse error.
- `explorers`: The tiles, authored as an `[.explorers]` section with
  one `url:` line per tile. Supply exactly 4 URLs, each an explorer or
  a multi-dim data page — any other kind of URL drops the whole block
  with a parse error. Each tile's title comes from the explorer itself,
  and its icon from the explorer's tag in the admin, so every explorer
  must be tagged and the tag needs an icon in the repo's tag-icons
  folder.
