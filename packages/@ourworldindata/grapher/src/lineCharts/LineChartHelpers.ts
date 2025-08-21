import { OwidTable } from "@ourworldindata/core-table"
import {
    ColumnSlug,
    EntityName,
    PrimitiveType,
    SeriesName,
    SeriesStrategy,
} from "@ourworldindata/types"

export type AnnotationsMap = Map<PrimitiveType, Set<PrimitiveType>>

export interface GetSeriesNameArgs {
    entityName: EntityName
    columnName: string
    seriesStrategy: SeriesStrategy
    hasMultipleEntitiesSelected?: boolean
    allowsMultiEntitySelection?: boolean
}

/**
 * Unique identifier for a series that is shared between line and slope charts
 * since focus states are built on top of it.
 */
export function getSeriesName({
    entityName,
    columnName,
    seriesStrategy,
    hasMultipleEntitiesSelected,
    allowsMultiEntitySelection,
}: GetSeriesNameArgs): SeriesName {
    // When plotting entities as series, use the entity name as the unique identifier
    if (seriesStrategy === SeriesStrategy.entity) return entityName

    // When plotting columns as series, use the column name. Prepend the entity
    // name if multiple entities can be selected or are currently selected to
    // ensure unique series names across all possible selection states
    return allowsMultiEntitySelection || hasMultipleEntitiesSelected
        ? `${entityName} - ${columnName}`
        : columnName
}

export function getDisplayName({
    entityName,
    columnName,
    seriesStrategy,
    hasMultipleEntitiesSelected,
}: Omit<GetSeriesNameArgs, "canSelectMultipleEntities">): SeriesName {
    // When plotting entities as series, each series represents one entity
    if (seriesStrategy === SeriesStrategy.entity) return entityName

    // When plotting columns as series, show just the column name by default.
    // Only prepend the entity name when multiple entities are currently selected
    // (this is different from series names that always include the entity name)
    return hasMultipleEntitiesSelected
        ? `${entityName} – ${columnName}` // Uses em dash for display
        : columnName
}

export function getColorKey({
    entityName,
    columnName,
    seriesStrategy,
    hasMultipleEntitiesSelected,
}: Omit<GetSeriesNameArgs, "canSelectMultipleEntities">): SeriesName {
    // When plotting entities as series, each entity gets its own color
    if (seriesStrategy === SeriesStrategy.entity) return entityName

    // When plotting columns as series, show just the column name by default.
    // Only prepend the entity name when multiple entities are currently selected
    // (this is different from series names that always include the entity name)
    return hasMultipleEntitiesSelected
        ? `${entityName} - ${columnName}`
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
