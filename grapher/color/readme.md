# Color Assignments

All of our charts have the notion of a Series with a color(string) property.

Colors can come from 5 places in this order:

-   An author defined color for a specific selected entity or column
-   Computed from a `ColorScale` if present
-   A `SeriesColorMap` by series name from a previously computed ColorScheme
-   Computed from a `ColorScheme`
-   A default color for a chart type

For ColorSchemes, colors are assigned in selection order for entities or columns.

If a LineChart has switched to a bar chart, the colors for the bars will come from the LineChart's `SeriesColorMap`.
