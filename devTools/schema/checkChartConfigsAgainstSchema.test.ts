import { describe, expect, it } from "vitest"
import { ADMIN_BASE_URL } from "../../settings/serverSettings.js"
import {
    adminUrlForOwner,
    buildReferenceIndex,
    buildReferenceIndexQuery,
    parseOwnerRef,
    REFERENCING_COLUMNS,
    renderValidationIssues,
    type RawReferenceRow,
    type ValidationIssueGroup,
} from "./checkChartConfigsAgainstSchema.js"

describe(buildReferenceIndexQuery, () => {
    it("selects owner identity for validated columns and NULL for the ones not validated", () => {
        const query = buildReferenceIndexQuery()

        expect(query).toContain(
            "SELECT `configId` AS id, 'charts.configId' AS reference, CAST(`charts`.`id` AS CHAR) AS ownerId, NULL AS ownerViewId FROM `charts`"
        )
        expect(query).toContain(
            "SELECT `chartConfigId` AS id, 'multi_dim_x_chart_configs.chartConfigId' AS reference, CAST(`multi_dim_x_chart_configs`.`multiDimId` AS CHAR) AS ownerId, CAST(`multi_dim_x_chart_configs`.`viewId` AS CHAR) AS ownerViewId FROM `multi_dim_x_chart_configs`"
        )
        expect(query).toContain(
            "SELECT `chartConfigId` AS id, 'narrative_charts.chartConfigId' AS reference, CAST(`narrative_charts`.`id` AS CHAR) AS ownerId, NULL AS ownerViewId FROM `narrative_charts`"
        )
        expect(query).toContain(
            "SELECT `patchConfigIdETL` AS id, 'variables.patchConfigIdETL' AS reference, CAST(`variables`.`id` AS CHAR) AS ownerId, NULL AS ownerViewId FROM `variables`"
        )
        expect(query).toContain(
            "SELECT `chartConfigId` AS id, 'explorer_views.chartConfigId' AS reference, NULL AS ownerId, NULL AS ownerViewId FROM `explorer_views`"
        )
        expect(query).toContain(
            "SELECT `viewConfigId` AS id, 'multi_dim_redirects.viewConfigId' AS reference, NULL AS ownerId, NULL AS ownerViewId FROM `multi_dim_redirects`"
        )
    })
})

describe(parseOwnerRef, () => {
    function row(
        ownerId: string | null,
        ownerViewId: string | null = null
    ): RawReferenceRow {
        return {
            id: "config-id",
            reference: "charts.configId",
            ownerId,
            ownerViewId,
        }
    }

    it("returns the owner's id for each owner kind, and the view id for multiDim", () => {
        expect(parseOwnerRef("chart", row("1"))).toEqual({
            owner: "chart",
            id: "1",
        })
        expect(parseOwnerRef("indicator", row("2"))).toEqual({
            owner: "indicator",
            id: "2",
        })
        expect(parseOwnerRef("narrativeChart", row("3"))).toEqual({
            owner: "narrativeChart",
            id: "3",
        })
        expect(parseOwnerRef("multiDim", row("4", "4-view"))).toEqual({
            owner: "multiDim",
            id: "4",
            viewId: "4-view",
        })
    })

    it("throws when a multiDim row has no view id", () => {
        expect(() => parseOwnerRef("multiDim", row("4", null))).toThrow(
            /config-id/
        )
    })
})

describe(buildReferenceIndex, () => {
    it("indexes each config id with its column and owner, and no owner when the column is not validated", () => {
        const rows: RawReferenceRow[] = [
            {
                id: "chart-config-id",
                reference: "charts.configId",
                ownerId: "1",
                ownerViewId: null,
            },
            {
                id: "explorer-config-id",
                reference: "explorer_views.chartConfigId",
                ownerId: null,
                ownerViewId: null,
            },
        ]

        const { index } = buildReferenceIndex(rows)

        expect(index.get("chart-config-id")).toEqual({
            column: "charts.configId",
            validated: {
                reference: REFERENCING_COLUMNS["charts.configId"],
                owner: { owner: "chart", id: "1" },
            },
        })
        expect(index.get("explorer-config-id")).toEqual({
            column: "explorer_views.chartConfigId",
            validated: null,
        })
    })
})

describe(adminUrlForOwner, () => {
    it("links a chart to its edit page", () => {
        expect(adminUrlForOwner({ owner: "chart", id: "42" })).toBe(
            `${ADMIN_BASE_URL}/admin/charts/42/edit`
        )
    })

    it("links a narrative chart to its edit page", () => {
        expect(adminUrlForOwner({ owner: "narrativeChart", id: "42" })).toBe(
            `${ADMIN_BASE_URL}/admin/narrative-charts/42/edit`
        )
    })

    it("links a multiDim to its page", () => {
        expect(
            adminUrlForOwner({ owner: "multiDim", id: "7", viewId: "energy" })
        ).toBe(`${ADMIN_BASE_URL}/admin/multi-dims/7`)
    })

    it("links an indicator to its variable page", () => {
        expect(adminUrlForOwner({ owner: "indicator", id: "42" })).toBe(
            `${ADMIN_BASE_URL}/admin/variables/42`
        )
    })
})

describe(renderValidationIssues, () => {
    it("names the referencing column and the count out of the validated total", () => {
        const issues = new Map<string, ValidationIssueGroup>([
            [
                "charts.configId|/title|must be a string",
                {
                    column: "charts.configId",
                    pointer: "/title",
                    message: "must be a string",
                    count: 1,
                    exampleOwners: [{ owner: "chart", id: "42" }],
                },
            ],
        ])
        const validatedCounts = new Map([["charts.configId", 5122]])

        expect(renderValidationIssues(issues, validatedCounts)).toEqual([
            `  charts.configId /title: must be a string (1 of 5122, e.g. ${ADMIN_BASE_URL}/admin/charts/42/edit)`,
        ])
    })

    it("includes the view id in an mdim group's example", () => {
        const issues = new Map<string, ValidationIssueGroup>([
            [
                "multi_dim_x_chart_configs.chartConfigId|/title|must be a string",
                {
                    column: "multi_dim_x_chart_configs.chartConfigId",
                    pointer: "/title",
                    message: "must be a string",
                    count: 1,
                    exampleOwners: [
                        { owner: "multiDim", id: "7", viewId: "energy" },
                    ],
                },
            ],
        ])
        const validatedCounts = new Map([
            ["multi_dim_x_chart_configs.chartConfigId", 9503],
        ])

        expect(renderValidationIssues(issues, validatedCounts)).toEqual([
            `  multi_dim_x_chart_configs.chartConfigId /title: must be a string (1 of 9503, e.g. ${ADMIN_BASE_URL}/admin/multi-dims/7 (view energy))`,
        ])
    })

    it("renders 'none' for an empty map", () => {
        expect(renderValidationIssues(new Map(), new Map())).toEqual(["  none"])
    })
})
