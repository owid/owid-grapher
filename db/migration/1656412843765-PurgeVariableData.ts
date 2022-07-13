import { MigrationInterface, QueryRunner } from "typeorm"
import fs from "fs-extra"
import { BAKED_SITE_DIR } from "../../settings/serverSettings.js"

export class PurgeVariableData1656412843765 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await fs.remove(`${BAKED_SITE_DIR}/grapher/data/variables`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // do nothing
    }
}
