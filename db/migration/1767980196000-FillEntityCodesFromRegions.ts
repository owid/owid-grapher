import { MigrationInterface, QueryRunner } from "typeorm"
import regions from "@ourworldindata/utils/src/regions.json"

interface Region {
    name: string
    code?: string
}

// Build name -> code mapping from regions.json
const nameToCode: Record<string, string> = {}
for (const region of regions as Region[]) {
    if (region.code) {
        nameToCode[region.name] = region.code
    }
}

export class FillEntityCodesFromRegions1767980196000
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Get all entities with null codes
        const entitiesWithNullCode = await queryRunner.query(`
            SELECT id, name FROM entities WHERE code IS NULL
        `)

        // Get all existing codes to avoid duplicates
        const existingCodes = await queryRunner.query(`
            SELECT code FROM entities WHERE code IS NOT NULL
        `)
        const existingCodeSet = new Set(
            existingCodes.map((row: { code: string }) => row.code)
        )

        let updatedCount = 0
        let skippedCount = 0
        for (const entity of entitiesWithNullCode) {
            const code = nameToCode[entity.name]
            if (code) {
                if (existingCodeSet.has(code)) {
                    console.log(
                        `Skipped entity "${entity.name}" - code "${code}" already exists`
                    )
                    skippedCount++
                    continue
                }
                await queryRunner.query(
                    `UPDATE entities SET code = ? WHERE id = ?`,
                    [code, entity.id]
                )
                existingCodeSet.add(code) // Track newly added codes
                updatedCount++
                console.log(
                    `Updated entity "${entity.name}" with code "${code}"`
                )
            }
        }

        console.log(
            `Updated ${updatedCount} entities, skipped ${skippedCount} (code already exists), out of ${entitiesWithNullCode.length} with null codes`
        )
    }

    // This migration only fills in missing codes, so we can revert by setting them back to NULL
    public async down(queryRunner: QueryRunner): Promise<void> {
        const names = Object.keys(nameToCode)
        if (names.length === 0) return

        // Only set to NULL for entities that match our regions.json names
        // and have codes that match what we would have set
        for (const [name, code] of Object.entries(nameToCode)) {
            await queryRunner.query(
                `UPDATE entities SET code = NULL WHERE name = ? AND code = ?`,
                [name, code]
            )
        }
    }
}
