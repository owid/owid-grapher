import { MigrationInterface, QueryRunner } from "typeorm"
import * as db from "../db.js"
import { GdocPost } from "../model/Gdoc/GdocPost.js"
import { enrichedBlocksToMarkdown } from "../model/Gdoc/enrichedToMarkdown.js"
import { createLinkFromUrl } from "../model/Link.js"
import { DodsTableName } from "@ourworldindata/types"
import { extractLinksFromMarkdown } from "@ourworldindata/utils"

async function migrateDodGdocToDb(
    trx: db.KnexReadWriteTransaction
): Promise<void> {
    const { details } = await GdocPost.DEPRECATED_getDetailsOnDemandGdoc(trx)

    for (const [name, detail] of Object.entries(details)) {
        const asMarkdown = enrichedBlocksToMarkdown(detail.text, false)
        if (!asMarkdown) {
            console.error(`Failed to convert ${name} to markdown`)
            continue
        }

        const [id] = await trx(DodsTableName).insert({
            name,
            content: asMarkdown,
            lastUpdatedUserId: 1,
        })

        const plaintextLinks = extractLinksFromMarkdown(asMarkdown)
        for (const [text, url] of plaintextLinks) {
            const link = createLinkFromUrl({
                url,
                sourceId: id,
                text,
                componentType: "dod",
            })
            await trx("dod_links").insert(link)
        }
    }
}

export class DodsInAdmin1745521253422 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE dods (
                id INTEGER PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(512) NOT NULL UNIQUE,
                content VARCHAR(4096) NOT NULL,
                createdAt TIMESTAMP NOT NULL DEFAULT now(),
                updatedAt TIMESTAMP NOT NULL DEFAULT now(),
                lastUpdatedUserId INTEGER NOT NULL,
                FOREIGN KEY (lastUpdatedUserId) REFERENCES users(id) ON DELETE CASCADE
            );
        `)
        await queryRunner.query(`-- sql
            CREATE TABLE dod_links (
                id INTEGER PRIMARY KEY AUTO_INCREMENT,
                sourceId INTEGER NOT NULL,
                target VARCHAR(1024) NOT NULL,
                componentType VARCHAR(128) NOT NULL DEFAULT 'dod',
                linkType ENUM('gdoc','url','grapher','explorer','chart-view') NOT NULL,
                text VARCHAR(1024) NOT NULL DEFAULT '',
                queryString VARCHAR(2048) NOT NULL DEFAULT '',
                hash VARCHAR(512) NOT NULL DEFAULT '',
                FOREIGN KEY (sourceId) REFERENCES dods(id) ON DELETE CASCADE
            );
        `)

        await queryRunner.query(`-- sql
            CREATE INDEX idx_dod_links_dod_id ON dod_links(sourceId);
        `)

        await db.knexReadWriteTransaction(
            async (trx: db.KnexReadWriteTransaction) => {
                await migrateDodGdocToDb(trx)
            }
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE dod_links;
        `)
        await queryRunner.query(`-- sql
            DROP TABLE dods;
        `)
    }
}
