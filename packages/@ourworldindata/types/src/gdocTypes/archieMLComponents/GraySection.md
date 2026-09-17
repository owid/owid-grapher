A full-width section with a light-gray background. Wraps any other
ArchieML content to visually set it apart from the surrounding prose.

```archie
[.+gray-section]
{.heading}
text: Explore Data on Energy
level: 1
{}
{.chart}
url: https://ourworldindata.org/explorers/energy?Total+or+Breakdown=Total&Energy+or+Electricity=Primary+energy&Metric=Per+capita+consumption&country=USA~GBR~CHN~OWID_WRL~IND~BRA~ZAF&tab=map&hideControls=false
size: wide
{}
[]
```

## When to use

- To group a small set of related blocks into a visually distinct section
  (e.g. a methods callout that includes a heading and a few paragraphs).
- Featuring an explorer or chart with an explanation beneath it.

## When NOT to use

- For single-block callouts — use `{.callout}` instead (smaller, inline).
- For recirculation modules — use `{.recirc}`.

## Properties

- `items`: The wrapped content. There is no named key — the block is
  itself a freeform section, so everything between `[.+gray-section]` and
  the closing `[]` renders on the gray background. Any blocks are allowed
  (headings, text, charts, explorers, …); an empty section renders an
  empty gray band.
