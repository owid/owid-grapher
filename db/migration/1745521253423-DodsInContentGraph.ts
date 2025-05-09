import { MigrationInterface, QueryRunner } from "typeorm"
import { gdocFromJSON } from "../model/Gdoc/GdocFactory.js"
import {
    ContentGraphLinkType,
    DbInsertPostGdocLink,
} from "@ourworldindata/types"

async function insertExistingGdocDodLinks(
    queryRunner: QueryRunner
): Promise<void> {
    console.log("Inserting preexisting dod links")
    console.log("Getting published gdocs...")
    const gdocs = await queryRunner
        .query(
            `-- sql
            SELECT id, content FROM posts_gdocs
            WHERE published = 1`
        )
        .then((rows) =>
            rows.map((row: { id: string; content: string }) =>
                gdocFromJSON(row)
            )
        )
    console.log("Getting published gdocs... done")
    console.log(`Extracting dod links from ${gdocs.length} gdocs...`)
    const dodLinks: DbInsertPostGdocLink[] = []
    for (const gdoc of gdocs) {
        for (const link of gdoc.links) {
            if (link.linkType === "dod") {
                dodLinks.push({
                    componentType: "span-dod",
                    hash: "",
                    linkType: ContentGraphLinkType.Dod,
                    queryString: "",
                    sourceId: gdoc.id,
                    target: link.target,
                    text: link.text,
                } satisfies DbInsertPostGdocLink)
            }
        }
    }
    console.log(`Extracting dod links from ${gdocs.length} gdocs... done`)

    console.log(`Inserting ${dodLinks.length} dod links...`)

    for (const link of dodLinks) {
        await queryRunner.query(
            `-- sql
        INSERT INTO posts_gdocs_links (sourceId, target, componentType, linkType, text, queryString, hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                link.sourceId,
                link.target,
                link.componentType,
                link.linkType,
                link.text,
                link.queryString,
                link.hash,
            ]
        )
    }

    console.log(`Inserting ${dodLinks.length} dod links... done`)
}

export class DodsInContentGraph1745521253423 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Update posts_gdocs_links table to add 'dod' linkType to the enum
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs_links
            MODIFY COLUMN linkType ENUM('gdoc','url','grapher','explorer','chart-view', 'dod') NOT NULL;
        `)

        await insertExistingGdocDodLinks(queryRunner)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove 'dod' rows first
        await queryRunner.query(`-- sql
            DELETE FROM posts_gdocs_links WHERE linkType = 'dod';
        `)

        // Remove 'dod' from the enum
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs_links
            MODIFY COLUMN linkType ENUM('gdoc','url','grapher','explorer','chart-view') NOT NULL;
        `)
    }
}
