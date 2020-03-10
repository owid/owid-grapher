import { MigrationInterface, QueryRunner } from "typeorm"

export class DefaultAttribution1536292544035 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "UPDATE datasets SET createdByUserId=2, dataEditedByUserId=2, metadataEditedByUserId=2 WHERE namespace='owid' AND dataEditedByUserId=15"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        throw new Error()
    }
}
