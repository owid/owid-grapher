import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
]

// Manually exclude charts where the color change doesn't lead to a visible
// difference or an improved color palette
const excludeSlugs = [
    "chinas-rank-in-imports-of-goods",
    "world-regions-un2",
    "world-regions-un1",
    "number-of-deaths-from-malaria-who",
    "death-rate-from-malaria",
    "world-regions-according-to-pew",
    "comprehensive-nuclear-test-ban-treaty",
    "national-system-to-monitor-spread-of-antimicrobial-resistance-in-humans",
    "national-system-to-monitor-antimicrobials-usage-for-human-medicine",
    "countrys-top-destination-for-exports-of-goods",
    "countrys-top-source-of-imported-goods",
]

// Old OwidDistinctColors hex → new OwidMapColors hex
export const HEX_MIGRATION: Record<string, string> = {
    "#4c6a9c": "#526f9b", // Denim → MutedDenim
    "#00847e": "#238a84", // Teal → MutedTeal
    "#bc8e5a": "#c3a27c", // Camel → Sand
    "#c05917": "#cc7641", // DarkOrange → SoftOrange
    "#6d3e91": "#77538f", // Purple → SoftPurple
    "#c15065": "#b04e74", // DustyCoral → MutedCherry
    "#38aaba": "#5fb8c8", // Turquoise → SkyTurquoise
    "#3b8e1d": "#6fa54f", // Lime → LeafGreen
    "#578145": "#5b6d35", // OliveGreen → Olive
    "#e56e5a": "#e2a17a", // Peach → LightOrange
    "#58ac8c": "#4fb2ac", // LightTeal → LightTeal
    "#a2559c": "#a07ab8", // Mauve → LightPurple
    "#6e7581": "#b9b2a6", // Gray → Taupe
    "#d73c50": "#d94c3f", // Carol → Tomato
}

async function replaceColors(
    queryRunner: QueryRunner,
    mapping: [string, string][]
): Promise<void> {
    // Runs 14 (colors) * 3 (columns) = 42 queries
    for (const [fromHex, toHex] of mapping) {
        const fromHexUpper = fromHex.toUpperCase()

        for (const { table, column } of tables) {
            await queryRunner.query(
                `
                UPDATE ${table}
                SET ${column} = JSON_SET(
                    ${column},
                    '$.map.colorScale.customCategoryColors',
                    -- Replace old hex with new hex (case-insensitive)
                    CAST(
                        -- Replace lowercase variant
                        REPLACE(
                            -- Replace uppercase variant
                            REPLACE(
                                CAST(${column}->'$.map.colorScale.customCategoryColors' AS CHAR),
                                ?, ?
                            ),
                            ?, ?
                        )
                    AS JSON)
                )
                -- Only update rows that actually contain the old color (either case)
                WHERE (JSON_SEARCH(
                    ${column}->'$.map.colorScale.customCategoryColors',
                    'one',
                    -- Search for lowercase hex
                    ?
                ) IS NOT NULL
                   OR JSON_SEARCH(
                    ${column}->'$.map.colorScale.customCategoryColors',
                    'one',
                    -- Search for uppercase hex
                    ?
                ) IS NOT NULL)
                AND ${column}->>'$.slug' NOT IN (?)
            `,
                [
                    fromHex,
                    toHex,
                    fromHexUpper,
                    toHex,
                    fromHex,
                    fromHexUpper,
                    excludeSlugs,
                ]
            )
        }
    }
}

export class MigrateMapCustomCategoryColors1771509136386
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await replaceColors(queryRunner, Object.entries(HEX_MIGRATION))
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await replaceColors(
            queryRunner,
            Object.entries(HEX_MIGRATION).map(([from, to]) => [to, from])
        )
    }
}
