// todo: Remove this file when we've migrated OWID data and OWID charts to next version

import { EPOCH_DATE } from "grapher/core/GrapherConstants"
import {
    Color,
    ColumnTypeNames,
    ColumnSlug,
    CoreColumnSpec,
} from "coreTable/CoreTableConstants"
import { LegacyGrapherInterface } from "grapher/core/GrapherInterface"
import {
    diffDateISOStringInDays,
    groupBy,
    sortBy,
    trimObject,
} from "grapher/utils/Util"

import {
    LegacyVariablesAndEntityKey,
    LegacyEntityMeta,
    LegacyVariableConfig,
} from "./LegacyVariableCode"
import {
    OwidRow,
    RequiredColumnSpecs,
    OwidTableSlugs,
    OwidColumnSpec,
    EntityId,
} from "./OwidTableConstants"

declare type MapOfColumnSpecs = Map<ColumnSlug, CoreColumnSpec>

export const legacyVariablesToTabular = (
    json: LegacyVariablesAndEntityKey,
    colorMap = new Map<EntityId, Color>()
) => {
    let rows: OwidRow[] = []
    const entityMetaById: { [id: string]: LegacyEntityMeta } = json.entityKey
    const columnSpecs: MapOfColumnSpecs = new Map()
    RequiredColumnSpecs.forEach((spec) => {
        columnSpecs.set(spec.slug, spec)
    })

    const colorColumnSlug =
        colorMap.size > 0 ? OwidTableSlugs.entityColor : undefined
    if (colorColumnSlug) {
        columnSpecs.set(colorColumnSlug, {
            slug: colorColumnSlug,
            type: ColumnTypeNames.Color,
            name: colorColumnSlug,
        })
    }

    for (const key in json.variables) {
        const variable = json.variables[key]

        const entityNames =
            variable.entities?.map((id) => entityMetaById[id].name) || []
        const entityCodes =
            variable.entities?.map((id) => entityMetaById[id].code) || []

        const columnSpec = columnSpecFromLegacyVariable(variable)
        const columnSlug = columnSpec.slug
        columnSpec.isDailyMeasurement
            ? columnSpecs.set(OwidTableSlugs.day, {
                  slug: OwidTableSlugs.day,
                  type: ColumnTypeNames.Date,
                  name: "Date",
              })
            : columnSpecs.set(OwidTableSlugs.year, {
                  slug: OwidTableSlugs.year,
                  type: ColumnTypeNames.Year,
                  name: "Year",
              })
        columnSpecs.set(columnSlug, columnSpec)

        // todo: remove. move annotations to their own first class column.
        let annotationsColumnSlug: string
        let annotationMap: Map<string, string>
        if (variable.display?.entityAnnotationsMap) {
            annotationsColumnSlug = `${columnSlug}-annotations`
            annotationMap = annotationsToMap(
                variable.display.entityAnnotationsMap
            )
            columnSpecs.set(annotationsColumnSlug, {
                slug: annotationsColumnSlug,
                type: ColumnTypeNames.SeriesAnnotation,
                name: `${columnSpec.name} Annotations`,
            })
        }

        const timeColumnName = columnSpec.isDailyMeasurement
            ? OwidTableSlugs.day
            : OwidTableSlugs.year

        // Todo: remove
        const display = variable.display
        const yearsNeedTransform =
            display &&
            display.yearIsDay &&
            display.zeroDay !== undefined &&
            display.zeroDay !== EPOCH_DATE
        const yearsRaw = variable.years || []
        const years =
            yearsNeedTransform && display
                ? convertLegacyYears(yearsRaw, display.zeroDay!)
                : yearsRaw

        const values = variable.values || []
        const entities = variable.entities || []

        const newRows = values.map((value, index) => {
            const entityName = entityNames[index]
            const entityId = entities[index]
            const time = years[index]
            const row: OwidRow = {
                [timeColumnName]: time,
                time,
                [columnSlug]: value,
                entityName,
                entityId,
                entityCode: entityCodes[index],
            }
            if (annotationsColumnSlug)
                row[annotationsColumnSlug] = annotationMap.get(entityName)

            if (colorColumnSlug) {
                const color = colorMap.get(entityId)
                if (color) row[colorColumnSlug] = color
            }
            return row
        })
        rows = rows.concat(newRows)
    }
    const groupMap = groupBy(rows, (row) => {
        const timePart =
            row.year !== undefined ? `year:${row.year}` : `day:${row.day}`
        return timePart + " " + row.entityName
    })

    const joinedRows: OwidRow[] = Object.keys(groupMap).map((groupKey) =>
        Object.assign({}, ...groupMap[groupKey])
    )

    return {
        rows: sortBy(joinedRows, [OwidTableSlugs.year, OwidTableSlugs.day]),
        columnSpecs,
    }
}

// todo: remove
const convertLegacyYears = (years: number[], zeroDay: string) => {
    // Only shift years if the variable zeroDay is different from EPOCH_DATE
    // When the dataset uses days (`yearIsDay == true`), the days are expressed as integer
    // days since the specified `zeroDay`, which can be different for different variables.
    // In order to correctly join variables with different `zeroDay`s in a single chart, we
    // normalize all days to be in reference to a single epoch date.
    const diff = diffDateISOStringInDays(zeroDay, EPOCH_DATE)
    return years.map((y) => y + diff)
}

const columnSpecFromLegacyVariable = (
    variable: LegacyVariableConfig
): OwidColumnSpec => {
    const slug = variable.id.toString() // For now, the variableId will be the column slug
    const {
        unit,
        shortUnit,
        description,
        coverage,
        datasetId,
        datasetName,
        source,
        display,
    } = variable

    // Without this the much used var 123 appears as "Countries Continent". We could rename in Grapher but not sure the effects of that.
    const isContinent = variable.id == 123
    const name = isContinent ? "Continent" : variable.name

    return {
        name,
        slug,
        isDailyMeasurement: variable.display?.yearIsDay,
        unit,
        shortUnit,
        description,
        coverage,
        datasetId,
        datasetName,
        display,
        source,
        owidVariableId: variable.id,
        type: isContinent ? ColumnTypeNames.Continent : ColumnTypeNames.Numeric,
    }
}

const annotationsToMap = (annotations: string) => {
    // Todo: let's delete this and switch to traditional columns
    const entityAnnotationsMap = new Map<string, string>()
    const delimiter = ":"
    annotations.split("\n").forEach((line) => {
        const [key, ...words] = line.split(delimiter)
        entityAnnotationsMap.set(key.trim(), words.join(delimiter).trim())
    })
    return entityAnnotationsMap
}

// This takes both the Variables and Dimensions data and generates an OwidTable.
export const legacyToOwidTable = (
    json: LegacyVariablesAndEntityKey,
    grapherConfig: Partial<LegacyGrapherInterface> = {}
) => {
    const colorMap = new Map<EntityId, Color>()
    grapherConfig.selectedData
        ?.filter((item) => item.entityId && item.color)
        .forEach((item) => {
            colorMap.set(item.entityId, item.color!)
        })

    const { rows, columnSpecs } = legacyVariablesToTabular(json, colorMap)

    const dimensions = grapherConfig.dimensions || []

    // todo: when we ditch dimensions and just have computed columns things like conversion factor will be easy (just a computed column)
    const convertValues = (slug: ColumnSlug, unitConversionFactor: number) => {
        rows.forEach((row) => {
            const value = row[slug]
            if (value !== undefined && value !== null)
                row[slug] = value * unitConversionFactor
        })
    }
    Array.from(columnSpecs.values())
        .filter((col) => col.display?.conversionFactor !== undefined)
        .forEach((col) => {
            const { slug, display } = col
            convertValues(slug, display!.conversionFactor!)
        })

    dimensions
        .filter((dim) => dim.display?.conversionFactor !== undefined)
        .forEach((dimension) => {
            const { display, variableId } = dimension
            convertValues(variableId.toString(), display!.conversionFactor!)
        })

    dimensions.forEach((dim) => {
        const colSpec = columnSpecs.get(dim.variableId.toString())!
        colSpec.display = {
            ...trimObject(colSpec.display),
            ...trimObject(dim.display),
        }
    })

    return { rows, specs: Array.from(columnSpecs.values()) }
}
