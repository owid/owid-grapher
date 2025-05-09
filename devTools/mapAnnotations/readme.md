# Map Annotation Placements

This script generates map annotation placements, which are saved in a [JSON file](../../packages/@ourworldindata/grapher/src/mapCharts/MapAnnotationPlacements.json). These placements are used by Grapher to display values on maps.

Annotations can be placed in one of two ways:

- Internal annotations: Positioned within a country’s borders
- External annotations: Positioned outside a country’s borders, connected to an anchor point by a line

Internal annotations are automatically computed by the `generate.ts` script. However, you can override the computed placements by manually specifying internal annotations in the `ManualAnnotationPlacements.json` file.

External annotations are configured manually by editing the `ManualAnnotationPlacements.json` file. External annotation placements are only specified for countries with a border to the sea.

Entries in `ManualAnnotationPlacements.json` are defined as follows:

```ts
interface ManualAnnotationPlacement {
    id: string // feature id / country name

    // The internal label will be placed at the center of the ellipse
    internal?: {
        ellipse: {
            cx: number // center x
            cy: number // center y
            left: number // x-coord of leftmost point
            top: number // y-coord of topmost point
        }
    }

    // External labels are placed according to an anchor point (typically inside the country)
    // and a direction (left, right, top, bottom, leftTop, leftBottom, rightTop, rightBottom).
    // A line is drawn from the anchor point along the specified direction and the label is placed
    // at the end of the line.
    external?: {
        direction:
            | "left"
            | "right"
            | "top"
            | "bottom"
            | "leftTop"
            | "leftBottom"
            | "rightTop"
            | "rightBottom"
        anchorPoint: [number, number]
        // External labels are usually only specified for countries with a border to the sea.
        // However, some countries don't have a sea border, but are not far from the sea
        // (e.g. Lesotho and Eswatini). In these cases, the `bridgeCountries` property can be
        // used to specify neighboring countries that do have a sea border (e.g. South Africa).
        // The code will then make sure that the label is placed in the ocean and the line
        // 'bridges' all `bridgeCountries`.
        bridgeCountries?: string[]
    }
}
```
