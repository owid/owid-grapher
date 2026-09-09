import { expect, it, describe } from "vitest"
import { parseJsonLogic } from "react-querybuilder/parseJsonLogic"
import type { RuleGroupType } from "react-querybuilder"
import {
    chartBulkUpdateAllowedColumnNamesAndTypes,
    WHITELISTED_SQL_COLUMN_NAMES,
} from "../adminShared/AdminSessionTypes.js"
import {
    OperationContext,
    parseToOperation,
} from "../adminShared/SqlFilterSExpression.js"
import {
    filterQueryToSExpression,
    promoteCustomOperators,
    ReadOnlyColumn,
    SExpressionToJsonLogic,
} from "./GrapherConfigGridEditorTypesAndUtils.js"

const context: OperationContext = {
    grapherConfigFieldName: "chart_configs.config",
    whitelistedColumnNamesAndTypes: chartBulkUpdateAllowedColumnNamesAndTypes,
}

const readOnlyColumns = new Map<string, ReadOnlyColumn>([
    [
        "lastEditedByUser",
        {
            label: "Last edited by user",
            key: "lastEditedByUser",
            type: "string",
            sExpressionColumnTarget:
                WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_CHART_LAST_EDITED_BY_USER,
        },
    ],
    [
        "createdAt",
        {
            label: "Created at",
            key: "createdAt",
            type: "datetime",
            sExpressionColumnTarget:
                WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_CHART_CREATED_AT,
        },
    ],
])

/** Emulates what GrapherConfigGridEditor does when loading a filter from the
    query string: S-expression → JsonLogic → react-querybuilder query */
function sExpressionToFilterQuery(sExpressionString: string): RuleGroupType {
    const operation = parseToOperation(sExpressionString, context)!
    const jsonLogic = SExpressionToJsonLogic(operation, readOnlyColumns)
    const query = parseJsonLogic(JSON.stringify(jsonLogic)) as RuleGroupType
    promoteCustomOperators(query)
    return query
}

describe("filter query round trip through react-querybuilder", () => {
    const cases = [
        `(AND (CONTAINS editedByUser.fullName "nuclear") (= /type "LineChart"))`,
        `(OR (< /minTime 2000) (>= /minTime 2010))`,
        `(NOT (AND (ISNULL /subtitle)))`,
        `(AND (ISNOTNULL /title) (= /hideLegend true))`,
        `(AND (= /minTime "latest"))`,
        `(AND (= /maxTime "earliest") (<= /maxTime 2020))`,
        `(AND (= /subtitle ""))`,
        `(AND (<> /note ""))`,
        `(AND (<> /type "ScatterPlot"))`,
        `(AND (CONTAINS editedByUser.fullName "wildfire") (OR (ISNULL /subtitle) (> /minTime 2000)))`,
    ]

    for (const sExpressionString of cases) {
        it(`round trips ${sExpressionString}`, () => {
            const query = sExpressionToFilterQuery(sExpressionString)
            const backConverted = filterQueryToSExpression(
                query,
                context,
                readOnlyColumns
            )
            expect(backConverted?.toSExpr()).toEqual(sExpressionString)
        })
    }
})

describe(filterQueryToSExpression, () => {
    it("drops incomplete rules", () => {
        const query: RuleGroupType = {
            combinator: "and",
            rules: [
                {
                    field: "lastEditedByUser",
                    operator: "contains",
                    value: "energy",
                },
                { field: "/minTime", operator: "<", value: "" },
                { field: "/title", operator: "=", value: "" },
                { field: "/title", operator: "!=", value: "" },
                { field: "/subtitle", operator: "contains", value: "" },
            ],
        }
        expect(
            filterQueryToSExpression(query, context, readOnlyColumns)?.toSExpr()
        ).toEqual(`(AND (CONTAINS editedByUser.fullName "energy"))`)
    })

    it("ignores rules where no field has been selected yet", () => {
        const query: RuleGroupType = {
            combinator: "and",
            rules: [
                { field: "~", operator: "=", value: "" },
                {
                    field: "lastEditedByUser",
                    operator: "contains",
                    value: "energy",
                },
            ],
        }
        expect(
            filterQueryToSExpression(query, context, readOnlyColumns)?.toSExpr()
        ).toEqual(`(AND (CONTAINS editedByUser.fullName "energy"))`)
    })

    it("returns undefined for an empty group", () => {
        const query: RuleGroupType = { combinator: "and", rules: [] }
        expect(
            filterQueryToSExpression(query, context, readOnlyColumns)
        ).toBeUndefined()
    })

    it("promotes loaded empty-string comparisons to isEmpty/isNotEmpty", () => {
        const query = sExpressionToFilterQuery(
            `(AND (= /subtitle "") (<> /note ""))`
        )
        expect(query.rules).toEqual([
            expect.objectContaining({
                field: "/subtitle",
                operator: "isEmpty",
            }),
            expect.objectContaining({ field: "/note", operator: "isNotEmpty" }),
        ])
    })

    it("translates isEmpty/isNotEmpty to comparisons with the empty string", () => {
        const query: RuleGroupType = {
            combinator: "and",
            rules: [
                { field: "/subtitle", operator: "isEmpty", value: null },
                { field: "/note", operator: "isNotEmpty", value: null },
            ],
        }
        expect(
            filterQueryToSExpression(query, context, readOnlyColumns)?.toSExpr()
        ).toEqual(`(AND (= /subtitle "") (<> /note ""))`)
    })

    it("negates a group when not is set", () => {
        const query: RuleGroupType = {
            combinator: "or",
            not: true,
            rules: [{ field: "/title", operator: "null", value: null }],
        }
        expect(
            filterQueryToSExpression(query, context, readOnlyColumns)?.toSExpr()
        ).toEqual(`(NOT (OR (ISNULL /title)))`)
    })
})
