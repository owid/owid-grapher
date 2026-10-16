A rendered list of OWID's donors, pulled from the database — the empty
block just marks where the list renders.

```archie
{.donors}
{}
```

## When to use

- On the donate / about page where the donor list should appear.

## When NOT to use

- Anywhere else.

## Properties

- `value`: Not authored — the block is written empty (`{.donors}` /
  `{}`) and just marks where the list renders. The donor names are
  pulled from the database and grouped alphabetically; nothing about
  the list is configurable from the doc.
