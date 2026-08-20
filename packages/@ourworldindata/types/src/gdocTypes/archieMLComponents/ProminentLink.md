A visually prominent link tile. When pointing at another Google Doc
registered in the admin, all fields (title, description, thumbnail) are
auto-fetched; you can override any of them, and for non-gdoc URLs you
must supply them.

```archie
{.prominent-link}
url: https://docs.google.com/document/d/1MSK510rncMZBqM4yaIkeq4D4N0L70NIO5dt8rzX_6YU/edit
{}
```

```archie
{.prominent-link}
url: https://docs.owid.io/projects/etl/analyses/deadliest_animals/
title: Methodology
description: If you’re interested in digging deeper, we provide a more detailed methodological document that lays out the uncertainties and sources behind these numbers.
thumbnail: most-deadly-animal-featured.png
{}
```

## When to use

- Driving readers to a single, key related article or chart.

## When NOT to use

- Prefer `{.recirc}` for a small gray list of multiple related links.
- Prefer `{.cta}` for a simple arrow link.

## Properties

- `url`: The link target — a Google Doc URL of a published gdoc, a
  Grapher or explorer URL, or an external URL. Required; without it the
  block is dropped and reported as a parse error. For internal targets,
  passing just `url` is enough — the other fields are auto-fetched.
- `title`: The tile's headline. Omitted on an internal link, the linked
  article's or chart's own title is used. Required for external URLs —
  without it the block is dropped and reported as a parse error.
- `description`: Text under the headline. Omitted on an internal link,
  the linked article's excerpt/subtitle or the chart's subtitle is
  used; omitted on an external link, nothing is shown there.
- `thumbnail`: An image filename, only used for external links —
  internal links always show the linked article's featured image or the
  chart's thumbnail. Omitted on an external link, the tile shows no
  image.
