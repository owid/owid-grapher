import { MigrationInterface, QueryRunner } from "typeorm"

export class VariableCleanup1536206761921 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "ALTER TABLE variables CHANGE short_unit shortUnit VARCHAR(255)"
        )

        const variables = await queryRunner.query(
            "SELECT * FROM variables v JOIN datasets d ON d.id=v.datasetId"
        )
        for (const v of variables) {
            if (v.unit || v.shortUnit) {
                const display = JSON.parse(v.display)
                if (v.unit && display.unit === undefined) display.unit = v.unit
                if (v.shortUnit && display.shortUnit === undefined)
                    display.shortUnit = v.shortUnit

                if (JSON.stringify(display) !== v.display)
                    await queryRunner.query(
                        "UPDATE variables SET display=? WHERE id=?",
                        [JSON.stringify(display), v.id]
                    )
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        throw new Error()
    }
}
