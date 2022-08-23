import { MigrationInterface, QueryRunner } from "typeorm"

import {
    LegacyGrapherInterface,
    GrapherInterface,
} from "../../grapher/core/GrapherInterface.js"

export class MigrateSelectedData1661264304751 implements MigrationInterface {
    name = "MigrateSelectedData1661264304751"

    public transformConfig(config: LegacyGrapherInterface): GrapherInterface {
        return {}
    }

    public async up(queryRunner: QueryRunner): Promise<void> {}

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
