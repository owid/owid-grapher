import {
    ColumnSlug,
    ColumnTypeNames,
    CoreColumnDef,
    CoreRow,
} from "coreTable/CoreTableConstants"
import { EntityName } from "coreTable/OwidTableConstants"
import { csvParse } from "d3"
import moment from "moment"

// todo: auto import from covid repo.
export const covidAnnotations = `location,date,cases_series_annotations,deaths_series_annotations
Spain,2020-04-19,methodology change,
Spain,2020-04-25,methodology change,methodology change
Ecuador,2020-05-08,methodology change,
United Kingdom,2020-05-20,methodology change,
France,2020-06-02,methodology change,
India,2020-06-17,,earlier deaths added
Chile,2020-06-18,earlier cases added,
Italy,2020-06-25,,methodology change
United States,2020-06-26,,probable/earlier deaths added
United States,2020-07-01,,probable/earlier deaths added
United Kingdom,2020-07-03,methodology change,
Czech Republic,2020-07-05,,methodology change
Kyrgyzstan,2020-07-18,methodology change,methodology change
Chile,2020-07-18,,methodology change
Peru,2020-07-24,,earlier deaths added
European Union,,Some EU countries changed methodology. See country-by-country series.,Some EU countries changed methodology. See country-by-country series.
United Kingdom,2020-08-14,,methodology change
Luxembourg,2020-08-28,methodology change,
Bolivia,2020-09-07,,probable/earlier deaths added
Ecuador,2020-09-07,,probable/earlier deaths added`

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

enum CovidAnnotationColumnSlugs {
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
