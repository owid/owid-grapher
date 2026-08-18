A small grey bar of pill-shaped links, usually with a heading to the
left. Used on the homepage below the nav and on author pages to list
topic chips.

```archie
{.pill-row}
title: Topics covered by Joe on Our World in Data
[.pills]
text: Poverty
url: https://docs.google.com/document/d/1UjJLoGF5VMfn8U4C3ZSJQrPhc_jFRkeEhrhz5Ksfq7M/edit
text: Economic inequality
url: https://docs.google.com/document/d/1yzOrFd6uWvrAl2oFB3S67oOSbhgL1ffPHxjAqS7i-4w/edit
text: Economic Growth
url: https://docs.google.com/document/d/1gVSV2gqzPSTMI80gmHEgbaKeWalj6daqe519RtZaJ7I/edit
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
