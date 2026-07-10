An "enhanced image" block for flagship data visualizations. Registered
in the admin with a description and a source-data link; renders as a
regular image but a "Download" action opens a modal exposing the
additional metadata.

### Basic

```archie
{.static-viz}
name: grapher-static-viz-demo
{}
```

## When to use

- Flagship / bespoke data visualizations where readers should be able
  to inspect or download the underlying data.

## When NOT to use

- Regular photos, screenshots, or illustrations — use `{.image}`.
- Interactive charts — use `{.chart}` or `{.narrative-chart}`.

## Notes

Create the static viz in the admin (/admin/static-viz/) first — `name`
references it. The description and source-data link entered there are
what the download modal surfaces.
