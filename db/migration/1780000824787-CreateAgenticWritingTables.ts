import { MigrationInterface, QueryRunner } from "typeorm"

// "Agentic writing" — a playground for AI-authored content with an immutable
// version history and an editorial pipeline (private → submitted → published).
// Each row in `agentic_writing_lineages` is a single drafted piece; each row
// in `agentic_writing_versions` is an append-only snapshot of that piece at a
// point in time (initial, revision, or decision).
//
// The first content type is "data_nugget" — short, link-backed views of OWID
// chart data. Other content types can be added by extending the contentType
// enum on the lineage row.
export class CreateAgenticWritingTables1780000824787
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE agentic_writing_lineages (
                id int NOT NULL AUTO_INCREMENT,
                lineageKey varchar(255) NOT NULL,
                contentType enum('data_nugget') NOT NULL DEFAULT 'data_nugget',
                sourceId varchar(255) NOT NULL,
                localId varchar(64) NOT NULL,
                ownerUserId int NOT NULL,
                submittedAt datetime DEFAULT NULL,
                submittedByUserId int DEFAULT NULL,
                publishedAt datetime DEFAULT NULL,
                publishedByUserId int DEFAULT NULL,
                createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY lineageKey (lineageKey),
                KEY contentType (contentType),
                KEY ownerUserId (ownerUserId),
                KEY submittedAt (submittedAt),
                KEY publishedAt (publishedAt),
                CONSTRAINT agentic_writing_lineages_ibfk_1 FOREIGN KEY (ownerUserId) REFERENCES users (id),
                CONSTRAINT agentic_writing_lineages_ibfk_2 FOREIGN KEY (submittedByUserId) REFERENCES users (id),
                CONSTRAINT agentic_writing_lineages_ibfk_3 FOREIGN KEY (publishedByUserId) REFERENCES users (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs
        `)

        await queryRunner.query(`
            CREATE TABLE agentic_writing_versions (
                id int NOT NULL AUTO_INCREMENT,
                lineageId int NOT NULL,
                versionId varchar(64) NOT NULL,
                parentVersionId varchar(64) DEFAULT NULL,
                createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                createdByUserId int DEFAULT NULL,
                createdByLabel varchar(255) NOT NULL,
                kind enum('initial','decision','revision') NOT NULL,
                title text NOT NULL,
                description text NOT NULL,
                payload json NOT NULL,
                metadata json NOT NULL,
                reviewDecision enum('approved','rejected','request_revisions') DEFAULT NULL,
                reviewComment text DEFAULT NULL,
                reviewedAt datetime DEFAULT NULL,
                reviewedByUserId int DEFAULT NULL,
                reviewedByLabel varchar(255) DEFAULT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY lineage_version (lineageId, versionId),
                KEY lineageId_createdAt (lineageId, createdAt),
                CONSTRAINT agentic_writing_versions_ibfk_1 FOREIGN KEY (lineageId) REFERENCES agentic_writing_lineages (id) ON DELETE CASCADE,
                CONSTRAINT agentic_writing_versions_ibfk_2 FOREIGN KEY (createdByUserId) REFERENCES users (id),
                CONSTRAINT agentic_writing_versions_ibfk_3 FOREIGN KEY (reviewedByUserId) REFERENCES users (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP TABLE IF EXISTS agentic_writing_versions`
        )
        await queryRunner.query(
            `DROP TABLE IF EXISTS agentic_writing_lineages`
        )
    }
}
