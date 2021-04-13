import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateSuggestedChartRevisionsTable1618193628982
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            `CREATE TABLE \`suggested_chart_revisions\` (
                \`id\` bigint NOT NULL AUTO_INCREMENT, 
                \`chartId\` int, 
                \`userId\` int, 
                \`config\` json, 
                \`status\` varchar(8), 
                \`createdReason\` varchar(512), 
                \`decisionReason\` varchar(512), 
                \`createdAt\` datetime, 
                \`updatedAt\` datetime, 
                CHECK (\`status\` IN ('approved', 'rejected', 'pending')), 
                PRIMARY KEY (\`id\`) 
            ) 
            ENGINE=InnoDB 
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "DROP TABLE IF EXISTS `suggested_chart_revisions` "
        )
    }
}
