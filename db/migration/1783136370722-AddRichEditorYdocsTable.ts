import { MigrationInterface, QueryRunner } from "typeorm"

export class AddRichEditorYdocsTable1783136370722 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Live-collaboration state for natively-edited gdocs: one Yjs document
        // blob per doc (the compacted result of Y.encodeStateAsUpdate), stored
        // by the sync server on a debounce. The blob is a transport, never the
        // source of truth — the draft JSON in posts_gdocs_drafts is kept in
        // sync by materialization on every store, so a ydoc row can always be
        // discarded and reseeded (schema migrations, idle cleanup).
        await queryRunner.query(`-- sql
            CREATE TABLE posts_gdocs_ydocs (
                gdocId VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
                ydoc LONGBLOB NOT NULL,
                schemaVersion INT NOT NULL,
                generation VARCHAR(36) NOT NULL,
                seededFromRevisionId BIGINT UNSIGNED NULL,
                updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (gdocId),
                CONSTRAINT posts_gdocs_ydocs_gdocId_fk FOREIGN KEY (gdocId)
                    REFERENCES posts_gdocs (id) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS posts_gdocs_ydocs
        `)
    }
}
