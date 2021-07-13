import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateSuggestedChartRevisionsTable1618193628982
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            `CREATE TABLE \`suggested_chart_revisions\` (
                \`id\` bigint NOT NULL AUTO_INCREMENT, 
                \`chartId\` int NOT NULL, 
                \`createdBy\` int NOT NULL, 
                \`updatedBy\` int, 
                \`originalConfig\` json NOT NULL, 
                \`suggestedConfig\` json NOT NULL, 
                \`status\` varchar(8) NOT NULL, 
                \`suggestedReason\` varchar(512), 
                \`decisionReason\` varchar(512), 
                \`createdAt\` datetime NOT NULL, 
                \`updatedAt\` datetime NOT NULL, 
                \`originalVersion\` int GENERATED ALWAYS AS (\`originalConfig\`->>'$.version') NOT NULL,
                \`suggestedVersion\` int GENERATED ALWAYS AS (\`suggestedConfig\`->>'$.version') NOT NULL,
                \`isPendingOrFlagged\` boolean GENERATED ALWAYS AS ( IF(\`status\` IN ('pending', 'flagged'), TRUE, NULL) ),
                CHECK (\`status\` IN ('approved', 'rejected', 'pending', 'flagged')), 
                PRIMARY KEY (\`id\`),
                CONSTRAINT FOREIGN KEY (\`chartId\`) REFERENCES \`charts\` (\`id\`),
                CONSTRAINT FOREIGN KEY (\`createdBy\`) REFERENCES \`users\` (\`id\`),
                CONSTRAINT FOREIGN KEY (\`updatedBy\`) REFERENCES \`users\` (\`id\`),
                UNIQUE KEY (\`chartId\`, \`originalVersion\`, \`suggestedVersion\`, \`isPendingOrFlagged\`)
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
