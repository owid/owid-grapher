import { MigrationInterface, QueryRunner } from "typeorm"
import {
    cloneDeep,
    forEach,
    forOwn,
    isArray,
    isEqual,
    isObject,
    set,
} from "lodash"
import { OwidGdocPostContent } from "@ourworldindata/utils"

export class UpdateGdocRecircComponent1685107433682
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // sanity check that the migration works
        recursivelyFixRecircComponents(recircBefore)
        if (!isEqual(recircBefore, recircAfter)) {
            throw new Error(
                "The migration did not work as expected. Please check the code."
            )
        }

        // Now run the migration over all gdocs
        const allGdocs = await queryRunner.query(
            "SELECT id, slug, content FROM posts_gdocs"
        )
        for (const gdoc of allGdocs) {
            gdoc.content = JSON.parse(gdoc.content) as OwidGdocPostContent
            const old = cloneDeep(gdoc.content.body)
            recursivelyFixRecircComponents(gdoc.content.body)
            if (JSON.stringify(old) !== JSON.stringify(gdoc.content.body)) {
                console.log(`Updating callout component in gdoc ${gdoc.slug}`)
                await queryRunner.query(
                    "UPDATE posts_gdocs SET content = ? WHERE id = ?",
                    [JSON.stringify(gdoc.content), gdoc.id]
                )
            }
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        console.log("This migration is not currently reversible.")
    }
}
function recursivelyFixRecircComponents(node: any): void {
    if (isArray(node)) {
        // If the argument is an array, iterate over its elements.
        forEach(node, (item) => {
            recursivelyFixRecircComponents(item)
        })
    } else if (isObject(node)) {
        if (
            "type" in node &&
            node.type === "recirc" &&
            "items" in node &&
            isArray(node.items)
        ) {
            const items = node.items
            delete node.items
            const links = items.map((item) => ({
                url: item.url,
                type: "recirc-link",
            }))
            set(node, ["links"], links)
        }
        // If the argument is an object, iterate over its keys.
        forOwn(node, (value) => {
            // Recurse on the key's value.
            recursivelyFixRecircComponents(value)
        })
    }
}

const recircBefore = {
    items: [
        {
            url: "https://ourworldindata.org",
            author: {
                spanType: "span-simple-text",
                text: "Max Roser",
            },
            article: {
                spanType: "span-simple-text",
                text: "Article title 1",
            },
        },
        {
            url: "https://ourworldindata.org",
            author: {
                spanType: "span-simple-text",
                text: "Max Roser",
            },
            article: {
                spanType: "span-simple-text",
                text: "Article title 2",
            },
        },
    ],
    title: { spanType: "span-simple-text", text: "I am a recirc" },
    type: "recirc",
    parseErrors: [],
}

const recircAfter = {
    links: [
        { url: "https://ourworldindata.org", type: "recirc-link" },
        { url: "https://ourworldindata.org", type: "recirc-link" },
    ],
    title: { spanType: "span-simple-text", text: "I am a recirc" },
    type: "recirc",
    parseErrors: [],
}
