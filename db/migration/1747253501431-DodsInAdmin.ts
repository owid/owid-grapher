import { MigrationInterface, QueryRunner } from "typeorm"
import { enrichedBlocksToMarkdown } from "../model/Gdoc/enrichedToMarkdown.js"
import { createDodLinkFromUrl } from "../model/Link.js"
import {
    EnrichedBlockText,
    extractLinksFromMarkdown,
    ParseError,
} from "@ourworldindata/utils"
import * as R from "remeda"
import { EnrichedBlockWithParseErrors } from "@ourworldindata/types"
import { parseText } from "../model/Gdoc/rawToEnriched.js"

const GDOCS_DETAILS_ON_DEMAND_ID = "DEPRECATED"

type DEPRECATED_EnrichedDetail = {
    id: string
    text: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors

type DEPRECATED_DetailDictionary = Record<string, DEPRECATED_EnrichedDetail>

function DEPRECATED_parseDetails(details: unknown): {
    details: DEPRECATED_DetailDictionary
    parseErrors: ParseError[]
} {
    if (!Array.isArray(details))
        return {
            details: {},
            parseErrors: [
                {
                    message: `No details defined in document with id "${GDOCS_DETAILS_ON_DEMAND_ID}"`,
                },
            ],
        }

    function DEPRECATED_parseDetail(
        detail: unknown
    ): DEPRECATED_EnrichedDetail {
        const createError = (
            error: ParseError,
            id: string = "",
            text: EnrichedBlockText[] = []
        ): DEPRECATED_EnrichedDetail => ({
            id,
            text,
            parseErrors: [error],
        })

        if (!R.isPlainObject(detail))
            return createError({
                message: "Detail is not a plain-object and cannot be parsed",
            })
        if (typeof detail.id !== "string")
            return createError({
                message: "Detail does not have an id",
            })
        if (!Array.isArray(detail.text) || !detail.text.length)
            return createError({
                message: `Detail with id "${detail.id}" does not have any text`,
            })

        const enrichedText = detail.text.map(parseText)

        return {
            id: detail.id,
            text: enrichedText,
            parseErrors: [
                ...enrichedText.flatMap((text) =>
                    text.parseErrors.map((parseError) => ({
                        ...parseError,
                        message: `Text parse error in detail with id "${detail.id}": ${parseError.message}`,
                    }))
                ),
            ],
        }
    }

    const [enrichedDetails, detailsWithErrors] = R.partition(
        details.map(DEPRECATED_parseDetail),
        (detail) => !detail.parseErrors.length
    )

    return {
        details: R.indexBy(enrichedDetails, (d) => d.id),
        parseErrors: detailsWithErrors.flatMap((detail) => detail.parseErrors),
    }
}

async function migrateDodGdocToDb(queryRunner: QueryRunner): Promise<void> {
    console.log("Migrating dods from gdoc to db...")
    if (!GDOCS_DETAILS_ON_DEMAND_ID) {
        console.error(
            "Error: Cannot migrate dods. GDOCS_DETAILS_ON_DEMAND_ID is not set"
        )
        return
    }

    const details = await queryRunner
        .query(
            `-- sql
            SELECT * FROM posts_gdocs WHERE id = "${GDOCS_DETAILS_ON_DEMAND_ID}"`
        )
        .then((rows) => {
            const dodGdoc = rows[0]
            if (!dodGdoc) {
                console.error(
                    `Error: Cannot migrate dods. Gdoc with id ${GDOCS_DETAILS_ON_DEMAND_ID} not found`
                )
                return
            }
            const content = JSON.parse(dodGdoc.content)
            const rawDetails = content.details
            const parsedDetails = DEPRECATED_parseDetails(rawDetails)
            return parsedDetails
        })

    if (!details?.details) {
        console.error(
            `Error: Cannot migrate dods. Details are not set or empty`
        )
        return
    }

    console.log(
        `Inserting ${Object.values(details.details).length} dods into db...`
    )

    for (const [name, detail] of Object.entries(details.details)) {
        const asMarkdown = enrichedBlocksToMarkdown(detail.text, false)
        if (!asMarkdown) {
            console.error(`Failed to convert ${name} to markdown`)
            continue
        }

        await queryRunner.query(
            `-- sql
            INSERT INTO dods (name, content)
            VALUES (?, ?)
        `,
            [name, asMarkdown]
        )

        const id = await queryRunner
            .query(
                `-- sql
            SELECT id FROM dods WHERE name = ?`,
                [name]
            )
            .then((rows) => rows[0].id)

        const plaintextLinks = extractLinksFromMarkdown(asMarkdown)
        for (const [text, url] of plaintextLinks) {
            const link = createDodLinkFromUrl({
                url,
                sourceId: id,
                text,
                componentType: "markdown",
            })

            await queryRunner.query(
                `-- sql
                INSERT INTO dod_links (sourceId, target, componentType, linkType, text, queryString, hash)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
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
    }
    console.log(
        `Inserting ${Object.values(details.details).length} dods into db...done`
    )
}

export class DodsInAdmin1747253501431 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS dod_links;
        `)
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS dods;
        `)
        await queryRunner.query(
            `-- sql
            CREATE TABLE dods (
                id INTEGER PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(512) NOT NULL UNIQUE,
                content VARCHAR(4096) NOT NULL,
                createdAt TIMESTAMP NOT NULL DEFAULT now(),
                updatedAt TIMESTAMP NOT NULL DEFAULT now(),
                lastUpdatedUserId INTEGER NULL,
                FOREIGN KEY (lastUpdatedUserId) REFERENCES users(id) ON DELETE SET NULL

            );`
        )
        await queryRunner.query(`-- sql
            CREATE TABLE dod_links (
                id INTEGER PRIMARY KEY AUTO_INCREMENT,
                sourceId INTEGER NOT NULL,
                target VARCHAR(1024) NOT NULL,
                componentType VARCHAR(128) NOT NULL DEFAULT 'dod',
                linkType ENUM('gdoc','url','grapher','explorer','chart-view', 'dod') NOT NULL,
                text VARCHAR(1024) NOT NULL DEFAULT '',
                queryString VARCHAR(2048) NOT NULL DEFAULT '',
                hash VARCHAR(512) NOT NULL DEFAULT '',
                FOREIGN KEY (sourceId) REFERENCES dods(id) ON DELETE CASCADE
            );
        `)

        await queryRunner.query(`-- sql
            CREATE INDEX idx_dod_links_dod_id ON dod_links(sourceId);
        `)

        await migrateDodGdocToDb(queryRunner)
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
