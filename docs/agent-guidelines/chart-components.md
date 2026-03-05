# Chart component patterns

This document describes the patterns used across chart components in the grapher package (`packages/@ourworldindata/grapher/src/`).

## Component structure

Each chart type is split into three layers:

### State class (`*State.ts`)

The state class owns everything that is independent of layout. It takes a `ChartManager` (the grapher's configuration interface) and computes:

- Table transformations (filtering, interpolation, relative mode)
- Series data (the logical data series with values, colors, names)
- Focus state (`FocusArray` tracking which series are selected)
- Color assignment
- Error detection

The state class has no knowledge of bounds, axes, or pixel coordinates. This makes it reusable — the same state instance is shared between the full chart component and its thumbnail variant.

Examples: `LineChartState`, `StackedBarChartState`, `StackedDiscreteBarChartState`

### Chart component (`*Chart.tsx`)

The chart component is a MobX `@observer` React component that orchestrates rendering. It owns everything that depends on layout:

- Axis configuration and construction (`DualAxis`, `HorizontalAxis`)
- Legend setup (categorical or numeric color legends)
- Tooltip state and rendering
- Hover state tracking (which series names are hovered, from legend or chart interaction)
- The data chain from series through to render-ready data (see next section)
- Wiring mouse events to update hover/tooltip state

It delegates the actual SVG rendering of data elements to a stateless render component.

Examples: `LineChart`, `StackedBarChart`, `StackedAreaChart`

## The data chain: series to render

Chart data flows through a chain of progressively enriched types. Each step adds layout or interaction information to the previous one. The naming convention is:

```
Series → SizedSeries → PlacedSeries → RenderSeries
```

Not every chart uses every step — `Sized` is only needed when label measurement affects layout. The typical chain is:

| Step             | What it adds                                             | Example type                                      |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------- |
| **Series**       | Raw data: points, color, name, focus state               | `LineChartSeries`, `StackedSeries<Time>`          |
| **SizedSeries**  | Label measurements that feed back into layout (optional) | `SizedDiscreteBarRow`                             |
| **PlacedSeries** | Pixel coordinates for all visual elements                | `PlacedLineChartSeries`, `PlacedStackedBarSeries` |
| **RenderSeries** | Interaction state: hover, emphasis                       | `RenderLineChartSeries`, `RenderStackedBarSeries` |

### Where each step lives

- **Series** are computed in a `*State` class (e.g. `LineChartState`, `StackedDiscreteBarChartState`). The state class owns the data transformation pipeline: raw table → filtered/transformed table → series. It also holds the `FocusArray` and attaches a `focus: InteractionState` to each series.

- **Sized/Placed/Render** steps are computed properties in the chart component (e.g. `LineChart`, `StackedBarChart`). These depend on layout information (bounds, axes) that only the chart component knows.

## Stateless render components

The final `RenderSeries` types are passed to a dedicated render component that is responsible only for producing SVG. They receive fully pre-computed data and simply map it to SVG elements.

Good examples:

- `StackedBars` — receives `RenderStackedBarSeries[]`, renders `<rect>` elements with pre-computed positions and opacity
- `StackedAreas` — receives `RenderStackedAreaSeries[]`, renders `<path>` elements
- `Lines` — receives `RenderLineChartSeries[]`, renders line paths and markers

Render components look up visual styles from a style map keyed by `Emphasis`:

```typescript
const barOpacity = STACKED_BAR_STYLE[series.emphasis].opacity
```
