# Color Assignments

All of our charts have the notion of a Series with a color(string) property.

Colors can come from 5 places in this order:

1.  An author defined color for a specific selected entity or column
2.  Computed from a `ColorScale` if present
3.  A `SeriesColorMap` by series name from a previously computed ColorScheme
4.  Computed from a `ColorScheme`
5.  A default color for a chart type

For ColorSchemes, colors are assigned in selection order for entities or columns.

If a LineChart has switched to a bar chart, the colors for the bars will come from the LineChart's `SeriesColorMap`.
