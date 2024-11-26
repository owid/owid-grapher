import React from "react"
import { DimensionProperty } from "@ourworldindata/utils"
import { AdminLayout } from "./AdminLayout.js"
import { GrapherConfigGridEditor } from "./GrapherConfigGridEditor.js"
import {
    ColumnSet,
    GrapherConfigGridEditorConfig,
    GrapherConfigGridEditorSource,
    ReadOnlyColumn,
} from "./GrapherConfigGridEditorTypesAndUtils.js"
import {
    variableAnnotationAllowedColumnNamesAndTypes,
    WHITELISTED_SQL_COLUMN_NAMES,
} from "../adminShared/AdminSessionTypes.js"

const readOnlyVariableAnnotationColumnNamesFields: Map<string, ReadOnlyColumn> =
    new Map(
        [
            {
                key: "id",
                label: "Id",
                type: "number" as const,
                sExpressionColumnTarget:
                    WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_VARIABLE_ID,
            },
            {
                key: "name",
                label: "Indicator name",
                type: "string" as const,
                sExpressionColumnTarget:
                    WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_VARIABLE_NAME,
            },
            {
                key: "datasetname",
                label: "Dataset name",
                type: "string" as const,
                sExpressionColumnTarget:
                    WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_DATASET_NAME,
            },
            {
                key: "namespacename",
                label: "Namespace name",
                type: "string" as const,
                sExpressionColumnTarget:
                    WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_NAMESPACE_NAME,
            },
            {
                key: "description",
                label: "Description",
                type: "string" as const,
                sExpressionColumnTarget:
                    WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_VARIABLE_DESCRIPTION,
            },
            {
                key: "createdAt",
                label: "Created at",
                type: "datetime" as const,
                sExpressionColumnTarget:
                    WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_VARIABLE_CREATED_AT,
            },
            {
                key: "updatedAt",
                label: "Updated at",
                type: "datetime" as const,
                sExpressionColumnTarget:
                    WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_VARIABLE_UPDATED_AT,
            },
        ].map((item) => [item.key, item])
    )

const VARIABLE_ANNOTATIONS_HIDDEN_COLUMNS = new Set([
    "/$schema",
    "/id",
    "/map/variableId",
    "/version",
    "/dimensions/0/variableId",
    "/dimensions/0/property",
    "/slug",
    "/data",
    "/xAxis/removePointsOutsideDomain",
    "/xAxis/label",
    "/xAxis/min",
    "/xAxis/scaleType",
    "/xAxis/max",
    "/xAxis/canChangeScaleType",
    "/xAxis/facetDomain",
])

const variableAnnotationsColumnSets: ColumnSet[] = [
    {
        label: "Common",
        kind: "specificColumns",
        columns: [
            "name",
            "datasetname",
            "/chartTypes",
            "/hasMapTab",
            "/title",
            "/subtitle",
            "/note",
            "/dimensions/0/display/unit",
            "/dimensions/0/display/shortUnit",
        ],
    },
    { label: "All columns", kind: "allColumns" },
    {
        label: "Axis",
        kind: "specificColumns",
        columns: [
            "name",
            "datasetname",
            "/yAxis/removePointsOutsideDomain",
            "/yAxis/label",
            "/yAxis/min",
            "/yAxis/scaleType",
            "/yAxis/max",
            "/yAxis/canChangeScaleType",
            "/yAxis/facetDomain",
        ],
    },
    {
        label: "Color scales",
        kind: "specificColumns",
        columns: [
            "name",
            "/baseColorScheme",
            "/map/colorScale",
            "/colorScale",
            "/hasMapTab",
            "/chartTypes",
        ],
    },
]
const config: GrapherConfigGridEditorConfig = {
    source: GrapherConfigGridEditorSource.SourceVariableAnnotation,
    sExpressionContext: {
        grapherConfigFieldName: "grapherConfigAdmin",
        whitelistedColumnNamesAndTypes:
            variableAnnotationAllowedColumnNamesAndTypes,
    },
    apiEndpoint: "/api/variable-annotations",
    readonlyColumns: readOnlyVariableAnnotationColumnNamesFields,
    hiddenColumns: VARIABLE_ANNOTATIONS_HIDDEN_COLUMNS,
    columnSet: variableAnnotationsColumnSets,
    finalVariableLayerModificationFn: (id: number) => ({
        version: 1,
        dimensions: [{ property: DimensionProperty.y, variableId: id }],
    }),
}

export class VariablesAnnotationPage extends React.Component {
    render() {
        return (
            <AdminLayout title="Indicators">
                <main className="VariablesAnnotationPage">
                    <GrapherConfigGridEditor config={config} />
                </main>
            </AdminLayout>
        )
    }

    //dispose!: IReactionDisposer
}
