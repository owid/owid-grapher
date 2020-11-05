import { ColumnSlug, CoreRow } from "coreTable/CoreTableConstants"
import { ColumnTypeNames, CoreColumnDef } from "coreTable/CoreColumnDef"

import { EntityName } from "coreTable/OwidTableConstants"
import { csvParse } from "d3-dsv"
import moment from "moment"

// todo: auto import from covid repo.
export const covidAnnotations = `location,date,cases_series_annotations,deaths_series_annotations
Ecuador,2020-10-09,,probable/earlier deaths added
Mexico,2020-10-09,probable/earlier cases added,probable/earlier deaths added`

interface AnnotationsRow {
    location: EntityName
    date: string
    cases_series_annotations: string
    deaths_series_annotations: string
}

type date = string
const annotationRows = csvParse(covidAnnotations) as AnnotationsRow[]
const GlobalAnnotations = new Map<EntityName, AnnotationsRow>()
const PointAnnotations = new Map<EntityName, Map<date, AnnotationsRow>>()

annotationRows.forEach((annoRow) => {
    if (!annoRow.date) {
        GlobalAnnotations.set(annoRow.location, annoRow)
        return
    }
    if (!PointAnnotations.has(annoRow.location))
        PointAnnotations.set(annoRow.location, new Map())
    PointAnnotations.get(annoRow.location)!.set(annoRow.date, annoRow)
})

export enum CovidAnnotationColumnSlugs {
    cases_series_annotations = "cases_series_annotations",
    deaths_series_annotations = "deaths_series_annotations",
    case_fatality_rate_series_annotations = "case_fatality_rate_series_annotations",
}

const getSeriesAnnotationsFor = (row: CoreRow, columnSlug: ColumnSlug) => {
    const { entityName, date } = row
    const globalAnnotation = GlobalAnnotations.get(entityName)
    const pointAnnotation = PointAnnotations.get(entityName)?.get(date)
    if (!globalAnnotation && !pointAnnotation) return ""

    if (globalAnnotation) return globalAnnotation.deaths_series_annotations // we currently only have 1 of these and its the same for both columns

    const datePrefix = moment(pointAnnotation!.date).format("MMM D") + ": "

    const {
        cases_series_annotations,
        deaths_series_annotations,
    } = pointAnnotation!

    if (columnSlug === CovidAnnotationColumnSlugs.cases_series_annotations)
        return datePrefix + cases_series_annotations
    if (columnSlug === CovidAnnotationColumnSlugs.deaths_series_annotations)
        return datePrefix + deaths_series_annotations

    return `${datePrefix}${cases_series_annotations || ""}${
        deaths_series_annotations || ""
    }`
}

const dontIncludeInTable = { display: { includeInTable: false } }

export const CovidAnnotationColumnDefs: CoreColumnDef[] = [
    {
        ...dontIncludeInTable,
        slug: CovidAnnotationColumnSlugs.cases_series_annotations,
        type: ColumnTypeNames.SeriesAnnotation,
        fn: (row) =>
            getSeriesAnnotationsFor(
                row,
                CovidAnnotationColumnSlugs.cases_series_annotations
            ),
    },
    {
        ...dontIncludeInTable,
        slug: CovidAnnotationColumnSlugs.deaths_series_annotations,
        type: ColumnTypeNames.SeriesAnnotation,
        fn: (row) =>
            getSeriesAnnotationsFor(
                row,
                CovidAnnotationColumnSlugs.deaths_series_annotations
            ),
    },
    {
        ...dontIncludeInTable,
        slug: CovidAnnotationColumnSlugs.case_fatality_rate_series_annotations,
        type: ColumnTypeNames.SeriesAnnotation,
        fn: (row) =>
            getSeriesAnnotationsFor(
                row,
                CovidAnnotationColumnSlugs.case_fatality_rate_series_annotations
            ),
    },
]
