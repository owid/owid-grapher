import { OwidTable } from "@ourworldindata/core-table"
import {
    ColumnSlug,
    EntityName,
    PrimitiveType,
    SeriesName,
    SeriesStrategy,
} from "@ourworldindata/types"

export type AnnotationsMap = Map<PrimitiveType, Set<PrimitiveType>>

/**
 * Unique identifier for a series that must be shared between
 * line and slope charts since focus states are built on top of it.
 */
export function getSeriesName({
    entityName,
    columnName,
    seriesStrategy,
    selectedEntityNames,
}: {
    entityName: EntityName
    columnName: string
    seriesStrategy: SeriesStrategy
    selectedEntityNames: EntityName[]
}): SeriesName {
    // if entities are plotted, use the entity name
    if (seriesStrategy === SeriesStrategy.entity) return entityName

    // if columns are plotted, use the column name
    // and prepend the entity name if multiple entities are selected
    return selectedEntityNames.length > 1
        ? `${entityName} – ${columnName}`
        : columnName
}

export function getAnnotationsMap(
    table: OwidTable,
    slug: ColumnSlug
): AnnotationsMap | undefined {
    return table
        .getAnnotationColumnForColumn(slug)
        ?.getUniqueValuesGroupedBy(table.entityNameSlug)
}

export function getAnnotationsForSeries(
    annotationsMap: AnnotationsMap | undefined,
    seriesName: SeriesName
): string | undefined {
    const annotations = annotationsMap?.get(seriesName)
    if (!annotations) return undefined
    return Array.from(annotations.values())
        .filter((anno) => anno)
        .join(" & ")
}
