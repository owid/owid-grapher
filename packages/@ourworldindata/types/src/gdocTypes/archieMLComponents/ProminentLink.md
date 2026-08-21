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

## Notes

For a gdoc URL, passing just `url` is enough — all fields are
auto-fetched. For external URLs (or unmigrated articles), supply
`title`, `description`, and `thumbnail` yourself.
