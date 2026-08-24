import { expect, it, describe } from "vitest"
import { parseJsonLogic } from "react-querybuilder/parseJsonLogic"
import type { RuleGroupType } from "react-querybuilder"
import { variableAnnotationAllowedColumnNamesAndTypes } from "../adminShared/AdminSessionTypes.js"
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
    grapherConfigFieldName: "chart_configs.patch",
    whitelistedColumnNamesAndTypes:
        variableAnnotationAllowedColumnNamesAndTypes,
}

const readOnlyColumns = new Map<string, ReadOnlyColumn>([
    [
        "name",
        {
            label: "Indicator name",
            key: "name",
            type: "string",
            sExpressionColumnTarget: "variables.name",
        },
    ],
    [
        "createdAt",
        {
            label: "Created at",
            key: "createdAt",
            type: "datetime",
            sExpressionColumnTarget: "variables.createdAt",
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
        `(AND (CONTAINS variables.name "nuclear") (= /type "LineChart"))`,
        `(OR (< /minTime 2000) (>= /minTime 2010))`,
        `(NOT (AND (ISNULL /subtitle)))`,
        `(AND (ISNOTNULL /title) (= /hideLegend true))`,
        `(AND (= /minTime "latest"))`,
        `(AND (= /maxTime "earliest") (<= /maxTime 2020))`,
        `(AND (= /subtitle ""))`,
        `(AND (<> /note ""))`,
        `(AND (<> /type "ScatterPlot"))`,
        `(AND (CONTAINS variables.name "wildfire") (OR (ISNULL /subtitle) (> /minTime 2000)))`,
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
                { field: "name", operator: "contains", value: "energy" },
                { field: "/minTime", operator: "<", value: "" },
                { field: "/title", operator: "=", value: "" },
                { field: "/title", operator: "!=", value: "" },
                { field: "/subtitle", operator: "contains", value: "" },
            ],
        }
        expect(
            filterQueryToSExpression(query, context, readOnlyColumns)?.toSExpr()
        ).toEqual(`(AND (CONTAINS variables.name "energy"))`)
    })

    it("ignores rules where no field has been selected yet", () => {
        const query: RuleGroupType = {
            combinator: "and",
            rules: [
                { field: "~", operator: "=", value: "" },
                { field: "name", operator: "contains", value: "energy" },
            ],
        }
        expect(
            filterQueryToSExpression(query, context, readOnlyColumns)?.toSExpr()
        ).toEqual(`(AND (CONTAINS variables.name "energy"))`)
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
