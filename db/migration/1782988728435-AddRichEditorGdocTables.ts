import { MigrationInterface, QueryRunner } from "typeorm"

export class AddRichEditorGdocTables1782988728435
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Which pipeline authors a gdoc's body: "gdocs" (fetched from Google
        // Docs, the default) or "native" (edited in the admin rich editor,
        // enriched JSON is the source of truth).
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            ADD COLUMN authoringMode ENUM('gdocs', 'native') NOT NULL DEFAULT 'gdocs' AFTER publicationContext
        `)

        // Append-only content history for natively-edited gdocs. Autosaves
        // are pruned over time; "publish" revisions are kept forever.
        await queryRunner.query(`-- sql
            CREATE TABLE posts_gdocs_revisions (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                gdocId VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
                content JSON NOT NULL,
                kind ENUM('autosave', 'manual', 'publish', 'restore') NOT NULL DEFAULT 'autosave',
                label VARCHAR(255) NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                createdBy INT NULL,
                PRIMARY KEY (id),
                KEY idx_posts_gdocs_revisions_gdocId_createdAt (gdocId, createdAt),
                CONSTRAINT posts_gdocs_revisions_gdocId_fk FOREIGN KEY (gdocId)
                    REFERENCES posts_gdocs (id) ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT posts_gdocs_revisions_createdBy_fk FOREIGN KEY (createdBy)
                    REFERENCES users (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs
        `)

        // The working copy of a natively-edited gdoc. posts_gdocs.content
        // stays the published/live version; the draft is what the editor
        // loads and saves, and is promoted to posts_gdocs.content on publish.
        await queryRunner.query(`-- sql
            CREATE TABLE posts_gdocs_drafts (
                gdocId VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
                content JSON NOT NULL,
                revisionId BIGINT UNSIGNED NOT NULL,
                updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                updatedBy INT NULL,
                PRIMARY KEY (gdocId),
                CONSTRAINT posts_gdocs_drafts_gdocId_fk FOREIGN KEY (gdocId)
                    REFERENCES posts_gdocs (id) ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT posts_gdocs_drafts_revisionId_fk FOREIGN KEY (revisionId)
                    REFERENCES posts_gdocs_revisions (id),
                CONSTRAINT posts_gdocs_drafts_updatedBy_fk FOREIGN KEY (updatedBy)
                    REFERENCES users (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS posts_gdocs_drafts
        `)
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS posts_gdocs_revisions
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            DROP COLUMN authoringMode
        `)
    }
}
