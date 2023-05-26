import { MigrationInterface, QueryRunner } from "typeorm"
import { Gdoc } from "../model/Gdoc/Gdoc.js"
import {
    cloneDeep,
    forEach,
    forOwn,
    isArray,
    isEqual,
    isObject,
    set,
} from "lodash"

export class UpdateGdocRecircComponent1685107433682
    implements MigrationInterface
{
    public async up(_queryRunner: QueryRunner): Promise<void> {
        // sanity check that the migration works
        recursivelyFixCalloutComponents(recircBefore)
        if (!isEqual(recircBefore, recircAfter)) {
            throw new Error(
                "The migration did not work as expected. Please check the code."
            )
        }

        // Now run the migration over all gdocs
        const allGdocs = await Gdoc.find()
        for (const gdoc of allGdocs) {
            const old = cloneDeep(gdoc.content.body)
            recursivelyFixCalloutComponents(gdoc.content.body)
            if (JSON.stringify(old) !== JSON.stringify(gdoc.content.body)) {
                console.log(`Updating callout component in gdoc ${gdoc.slug}`)
                await gdoc.save()
            }
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        console.log("This migration is not currently reversible.")
    }
}
function recursivelyFixCalloutComponents(node: any): void {
    if (isArray(node)) {
        // If the argument is an array, iterate over its elements.
        forEach(node, (item) => {
            recursivelyFixCalloutComponents(item)
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
            recursivelyFixCalloutComponents(value)
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
