A small grey bar of pill-shaped links, usually with a heading to the
left. Used on the homepage below the nav and on author pages to list
topic chips.

### Basic

```archie
{.pill-row}
title: Popular Articles
[.pills]
text: Optimism & Pessimism
url: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk/edit

text: Life Expectancy
url: https://ourworldindata.org/grapher/life-expectancy
[]
{}
```

## When to use

- On the homepage, below the nav, to feature a short list of
  articles.
- On author pages, to list the topics the author writes about.

## When NOT to use

- As a general-purpose inline list — use `{.cta}`, `{.recirc}`, or
  normal links instead.

## Notes

Omit a pill's `text` for gdoc links — the gdoc title is used. On author
pages, keep the pills to one desktop line (about 5–7 topics).
