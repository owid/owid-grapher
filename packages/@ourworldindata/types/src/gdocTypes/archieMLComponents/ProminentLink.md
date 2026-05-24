A visually prominent link tile. When pointing at another Google Doc
registered in the admin, all fields (title, description, thumbnail) are
auto-fetched; you can override any of them, and for non-gdoc URLs you
must supply them.

## When to use
- Driving readers to a single, key related article or chart.

## When NOT to use
- Prefer `{.recirc}` for a small gray list of multiple related links.
- Prefer `{.cta}` for a simple arrow link.

## Variations
- Gdoc URL: all fields auto-fetched; pass just `url`.
- External URL or overrides: supply `title`, `description`, `thumbnail`.

### Gdoc URL (auto-fetched)

```archie
{.prominent-link}
url: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk
{}
```

### External URL with explicit fields

```archie
{.prominent-link}
url: https://ourworldindata.org
title: About Our World In Data
description: A simple description
thumbnail: default-featured-image.png
{}
```
