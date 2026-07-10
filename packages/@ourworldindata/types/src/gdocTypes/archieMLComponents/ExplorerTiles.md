A grid of tiles linking to data explorers. Typically shown on the
homepage. Each tile pulls its icon from the explorer's tag in admin.

### Four explorers

```archie
{.explorer-tiles}
title: Data explorers
subtitle: Interactive visualization tools.
[.explorers]
url: https://ourworldindata.org/explorers/poverty-explorer
url: https://ourworldindata.org/explorers/energy
url: https://ourworldindata.org/explorers/co2
url: https://ourworldindata.org/explorers/global-health
[]
{}
```

## When to use

- On the homepage to feature OWID data explorers.

## When NOT to use

- For a single explorer embed — use `{.chart}` with the explorer URL.

## Notes

Supply exactly 4 explorer URLs. Each explorer must be tagged in the
admin, and the tag needs an icon in the repo's tag-icons folder.
