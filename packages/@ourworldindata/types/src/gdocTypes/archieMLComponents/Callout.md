---
pinned:
    - slug: the-human-cost-of-unsafe-abortions
---

A small gray-background block used to draw attention to meta-textual
information — e.g. "data was last updated", caveats about methodology,
or short editorial notes.

```archie
{.callout}
icon: info
title: Note on the earlier version of this article
[.+text]
This is an update of an article that I published in May 2019 on Our World in Data, titled “<a href="https://web.archive.org/web/20190513154042/https://ourworldindata.org/extreme-poverty-projections">As the world’s poorest economies are stagnating, half a billion are expected to be in extreme poverty in 2030</a>”.
Based on even earlier projections, I also made this a central point of my presentation to the UN back in 2018, for which you can find my slides <a href="https://ourworldindata.org/max-un-slides">here</a>.
[]
{}
```

## When to use

- Flagging data freshness, caveats, or other meta-textual notes.
- Short side notes that should stand out from the main body.

## When NOT to use

- Prefer `{.aside}` for a plaintext caption placed to the side of a
  paragraph.
- Prefer `{.data-callout}` when interpolating live chart data.

## Notes

Use a `title` when the note stands alone. If placed inside a key insight,
omit it and make the first line (e.g. "What you should know about this
data") an h5 so the correct CSS applies.
