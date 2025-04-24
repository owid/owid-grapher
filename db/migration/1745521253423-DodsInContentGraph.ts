import { MigrationInterface, QueryRunner } from "typeorm"
import * as db from "../db.js"
import { gdocFromJSON } from "../model/Gdoc/GdocFactory.js"
import {
    ContentGraphLinkType,
    DbInsertPostGdocLink,
} from "@ourworldindata/types"

async function insertExistingGdocDodLinks(
    trx: db.KnexReadWriteTransaction
): Promise<void> {
    console.log("Inserting preexisting dod links")
    console.log("Getting published gdocs...")
    const gdocs = await db
        .getPublishedGdocsWithTags(trx)
        .then((gdocs) => gdocs.map(gdocFromJSON))
    console.log("Getting published gdocs... done")
    console.log(`Extracting dod links from ${gdocs.length} gdocs...`)
    const dodLinks: DbInsertPostGdocLink[] = []
    for (const gdoc of gdocs) {
        for (const link of gdoc.links) {
            if (link.linkType === "dod") {
                dodLinks.push({
                    componentType: "dod",
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
    await trx("posts_gdocs_links").insert(dodLinks)
    console.log(`Inserting ${dodLinks.length} dod links... done`)
}

export class DodsInContentGraph1745521253423 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Update posts_gdocs_links table to add 'dod' linkType to the enum
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs_links
            MODIFY COLUMN linkType ENUM('gdoc','url','grapher','explorer','chart-view', 'dod') NOT NULL;
        `)

        await db.knexReadWriteTransaction(async (trx) => {
            await insertExistingGdocDodLinks(trx)
        })
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
