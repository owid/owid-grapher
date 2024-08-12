## Lingo

### MDD

This directory contains code regarding multi-dimensional data pages, or MDDs for short.

### Dimension

A _dimension_ is one configurable aspect of the MDD, containing a multitude of _choices_.
A MDD usually has 2-5 dimensions.
Every dimension has a slug and a name, and the slug should not be changed once published.

Example: Dimension `Age group` with choices `All`, `0-14 years`, `15-64 years`, `65+ years`.

### Choice

A _choice_ is a particular option inside a dimension.
A choice has a slug and a name, and the slug should not be changed once published.

### Choice groups

Choices may be grouped into choice groups, if that's useful.
This is purely a UX consideration and doesn't affect the MDD in any other way.

For example, for a `Energy source` dimension, you may group the choices `Coal`, `Oil` and `Gas` under `Fossil fuels`.

### View

A view is a MDD configuration specified by the choices made in all dimensions.
It can also be understood as a grapher & datapage configuration object, which then decides what to render on the page below the dimension dropdowns.
There is at most one view for a given set of dimension-choice pairings.

### Indicators

An indicator or variable is an OWID indicator used to render a chart.
A view may specify one or more y indicators, and up to one x, size, and color indicator.
The first y indicator is considered the "main" indicator for a MDD, and its metadata is used to render the datapage information outside the charting area.
