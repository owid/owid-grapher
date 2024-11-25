import { GrapherInterface } from "@ourworldindata/types"
import { MigrationInterface, QueryRunner } from "typeorm"

export class MigrateSlopeCharts1732291572062 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const slopeCharts = await queryRunner.query(`
            -- sql
            SELECT c.id, cc.id AS configId, cc.patch, cc.full
            FROM charts c
            JOIN chart_configs cc ON cc.id = c.configId
            WHERE cc.chartType = 'SlopeChart'
        `)

        const configUpdatesById = new Map(
            configUpdates.map(({ id, config }) => [id, config])
        )

        for (const chart of slopeCharts) {
            const migrationConfig = configUpdatesById.get(chart.id)
            if (!migrationConfig) continue

            const patchConfig = JSON.parse(chart.patch)
            const fullConfig = JSON.parse(chart.full)

            const newPatchConfig = {
                ...patchConfig,
                ...migrationConfig,
            }
            const newFullConfig = {
                ...fullConfig,
                ...migrationConfig,
            }

            await queryRunner.query(
                `
                -- sql
                UPDATE chart_configs
                SET
                    patch = ?,
                    full = ?
                WHERE id = ?
            `,
                [
                    JSON.stringify(newPatchConfig),
                    JSON.stringify(newFullConfig),
                    chart.configId,
                ]
            )
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<void> {}
}

const configUpdates: { id: number; config: GrapherInterface }[] = [
    {
        id: 414,
        config: {
            title: "Top marginal income tax rate",
            selectedEntityNames: [
                "Colombia",
                "Guatemala",
                "Indonesia",
                "Iran",
                "Jamaica",
                "Pakistan",
                "Trinidad and Tobago",
                "Botswana",
                "Bolivia",
                "Japan",
                "United States",
                "Sweden",
                "Germany",
                "Netherlands",
                "Belgium",
                "France",
                "Ireland",
                "United Kingdom",
            ],
            hideRelativeToggle: true,
        },
    },
    {
        id: 415,
        config: {
            selectedEntityNames: [
                "Cirrhosis and other chronic liver diseases",
                "Neonatal disorders",
                "Congenital heart anomalies",
                "Diphtheria",
            ],
            entityType: "cause",
            entityTypePlural: "causes",
            hideRelativeToggle: true,
        },
    },
    {
        id: 679,
        config: {
            selectedEntityNames: [
                "Chad",
                "Iraq",
                "Benin",
                "Kenya",
                "Brazil",
                "Hungary",
            ],
            hideRelativeToggle: true,
        },
    },
    {
        id: 874,
        config: {
            selectedEntityNames: [
                "North America (WB)",
                "South Asia (WB)",
                "Europe and Central Asia (WB)",
                "Latin America and Caribbean (WB)",
            ],
            hideRelativeToggle: true,
        },
    },
    {
        id: 875,
        config: {
            selectedEntityNames: [
                "North America (WB)",
                "South Asia (WB)",
                "Latin America and Caribbean (WB)",
            ],
            hideRelativeToggle: true,
        },
    },
    {
        id: 1004,
        config: {
            selectedEntityNames: [
                "Palau",
                "Afghanistan",
                "Curacao",
                "Wallis and Futuna",
            ],
        },
    },
    { id: 1459, config: {} },
    { id: 1975, config: { selectedEntityNames: ["World"] } },
    {
        id: 2832,
        config: {
            selectedEntityNames: ["Norway", "Italy", "France", "Finland"],
            hideTimeline: true,
        },
    },
    {
        id: 2833,
        config: {
            selectedEntityNames: ["Belgium", "Poland", "Italy", "Germany"],
            hideTimeline: true,
        },
    },
    {
        id: 2834,
        config: {
            selectedEntityNames: ["Belgium", "Italy", "Spain", "Norway"],
        },
    },
    {
        id: 2835,
        config: {
            selectedEntityNames: [
                "Estonia",
                "Norway",
                "Poland",
                "United Kingdom",
            ],
            hideTimeline: true,
        },
    },
    {
        id: 2975,
        config: {
            selectedEntityNames: [
                "Germany",
                "Poland",
                "United Kingdom",
                "Finland",
            ],
            hideTimeline: true,
        },
    },
    {
        id: 2976,
        config: {
            selectedEntityNames: ["Poland", "Italy", "Spain", "Belgium"],
            hideTimeline: true,
        },
    },
    {
        id: 2977,
        config: {
            selectedEntityNames: ["Poland", "Norway", "Estonia", "Finland"],
            hideTimeline: true,
        },
    },
    {
        id: 2978,
        config: {
            selectedEntityNames: [
                "Poland",
                "Norway",
                "Belgium",
                "Estonia",
                "Italy",
            ],
            hideTimeline: true,
        },
    },
    {
        id: 2979,
        config: {
            selectedEntityNames: [
                "United Kingdom",
                "Estonia",
                "Belgium",
                "Italy",
            ],
            hideTimeline: true,
        },
    },
    {
        id: 3249,
        config: {
            selectedEntityNames: [
                "France",
                "Italy",
                "Japan",
                "Portugal",
                "Germany",
                "Mexico",
                "Norway",
                "Sweden",
                "Taiwan",
                "Sri Lanka",
                "United Kingdom",
                "United States",
            ],
        },
    },
    {
        id: 3359,
        config: {
            selectedEntityNames: [
                "Mali",
                "South Africa",
                "Nigeria",
                "Niger",
                "Chad",
                "Ethiopia",
                "Kenya",
                "Uganda",
                "Rwanda",
                "Burundi",
                "Tanzania",
                "Mozambique",
                "Madagascar",
                "Zambia",
                "Congo",
                "Democratic Republic of Congo",
                "Central African Republic",
                "Cameroon",
                "Togo",
                "Benin",
                "Sierra Leone",
                "Cote d'Ivoire",
                "Burkina Faso",
                "Guinea-Bissau",
                "Papua New Guinea",
                "Senegal",
                "Angola",
            ],
        },
    },
    {
        id: 3364,
        config: {
            selectedEntityNames: [
                "India",
                "Indonesia",
                "United States",
                "Antigua and Barbuda",
            ],
        },
    },
    {
        id: 3433,
        config: {},
    },
    {
        id: 3434,
        config: {},
    },
    {
        id: 3580,
        config: {
            entityTypePlural: "species",
        },
    },
    {
        id: 3620,
        config: {
            selectedEntityNames: ["Romania", "Benin", "Libya", "Suriname"],
        },
    },
    {
        id: 3627,
        config: {
            selectedEntityNames: [
                "Syrian Arab Republic",
                "East Asia & Pacific",
                "Costa Rica",
                "Malta",
            ],
        },
    },
    {
        id: 4408,
        config: {
            selectedEntityNames: [
                "East Asia (MPD)",
                "Latin America (MPD)",
                "Eastern Europe (MPD)",
                "Western Europe (MPD)",
                "Western offshoots (MPD)",
                "Sub Saharan Africa (MPD)",
                "South and South East Asia (MPD)",
                "Middle East and North Africa (MPD)",
                "World",
            ],
        },
    },
    {
        id: 4764,
        config: {
            entityTypePlural: "species",
        },
    },
    {
        id: 6219,
        config: {
            hideRelativeToggle: true,
        },
    },
    {
        id: 6529,
        config: {
            selectedEntityNames: ["United States", "Russia", "China"],
        },
    },
    {
        id: 7150,
        config: {
            selectedEntityNames: ["Burundi", "Togo", "Ethiopia", "Myanmar"],
        },
    },
    {
        id: 7206,
        config: {},
    },
    {
        id: 7220,
        config: {},
    },
    {
        id: 7221,
        config: {},
    },
    {
        id: 7226,
        config: {},
    },
    {
        id: 7344,
        config: {
            selectedEntityNames: [
                "Suriname",
                "Malta",
                "Australia",
                "Guatemala",
            ],
        },
    },
    {
        id: 7448,
        config: {
            hideRelativeToggle: true,
        },
    },
    {
        id: 8157,
        config: {
            selectedEntityNames: [
                "South Asia (WB)",
                "North America (WB)",
                "Sub-Saharan Africa (WB)",
                "East Asia and Pacific (WB)",
                "Europe and Central Asia (WB)",
                "Latin America and Caribbean (WB)",
                "Middle East and North Africa (WB)",
            ],
        },
    },
]
