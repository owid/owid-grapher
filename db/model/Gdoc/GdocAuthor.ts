import {
    OwidGdocErrorMessage,
    OwidGdocAuthorInterface,
    OwidGdocAuthorContent,
    RawBlockText,
    OwidEnrichedGdocBlock,
    OwidGdocErrorMessageType,
    DbEnrichedLatestWork,
    DEFAULT_GDOC_FEATURED_IMAGE,
    OwidGdocBaseInterface,
    excludeNullish,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"
import { htmlToEnrichedTextBlock } from "./htmlToEnriched.js"
import { parseSocials } from "./rawToEnriched.js"
import { getLatestWorkByAuthor } from "../Post.js"
import * as db from "../../../db/db.js"
import { loadPublishedGdocAuthors } from "./GdocFactory.js"

export class GdocAuthor extends GdocBase implements OwidGdocAuthorInterface {
    content!: OwidGdocAuthorContent
    latestWorkLinks?: DbEnrichedLatestWork[]

    constructor(id?: string) {
        super(id)
    }

    static create(obj: OwidGdocBaseInterface): GdocAuthor {
        const gdoc = new GdocAuthor()
        // We need to prevent obj methods from overriding GdocAuthor methods.
        // This happens when createGdocAndInsertIntoDb() passes a GdocBase
        // instance to loadGdocFromGdocBase(), instead of a simple object. In
        // this case, simply assigning obj to gdoc would override GdocAuthor
        // methods with GdocBase methods, in particular the
        // _enrichedSubclassContent. When creating a new author,
        // _enrichedSubclassContent would run from the base GdocBase class
        // instead of the GdocAuthor subclass, and the socials block would not
        // be shaped as an ArchieML block, thus throwing an error.

        // A first approach to avoid this would be to use Object.assign(), while
        // omitting functions:
        // Object.assign(gdoc, omitBy(obj, isFunction))

        // A better approach is to avoid registering these functions as
        // enumerable properties in the first place, so they are not listed by
        // Object.assign(). The simplest way to do this is to define them as
        // class methods, which are not enumerable, and instead attached to the
        // class prototype. When we call Object.assign(gdoc, obj), these methods
        // are ignored. Even after the assign, gdoc._enrichedSubclassContent()
        // will then still accurately target the GdocAuthor method, and not the
        // GdocBase method.
        Object.assign(gdoc, obj)
        return gdoc
    }
    protected typeSpecificFilenames(): string[] {
        return excludeNullish([this.content["featured-image"]])
    }

    _getSubclassEnrichedBlocks = (gdoc: this): OwidEnrichedGdocBlock[] => {
        const blocks: OwidEnrichedGdocBlock[] = []

        if (gdoc.content.socials) blocks.push(gdoc.content.socials)
        if (gdoc.content.bio) blocks.push(...gdoc.content.bio)

        return blocks
    }

    _loadSubclassAttachments = (
        knex: db.KnexReadonlyTransaction
    ): Promise<void> => {
        return this.loadLatestWorkImages(knex)
    }

    loadLatestWorkImages = async (
        knex: db.KnexReadonlyTransaction
    ): Promise<void> => {
        if (!this.content.title) return

        this.latestWorkLinks = await getLatestWorkByAuthor(
            knex,
            this.content.title
        )
        if (!this.latestWorkLinks) return

        // We want to load additional image filenames from the referenced
        // latest work links. We're not relying here on the Link
        // infrastructure as we don't yet have a good way of cleaning up
        // obsolete links from the latest work section. Usually the links
        // originating from a gdoc are cleaned up when updating/deleting it, but
        // here the links from the latest section will change independently of a
        // manual authoring and admin action, so they'll end up being stale
        // until the author page is updated again.
        const latestWorkImageFilenames = this.latestWorkLinks
            .map((d) => d["featured-image"])
            .filter(Boolean) as string[]

        // Load the image metadata for the latest work images, including the
        // default featured image which is used as a fallback in the entire
        // research and writing block
        return super.loadImageMetadataFromDB(knex, [
            ...latestWorkImageFilenames,
            DEFAULT_GDOC_FEATURED_IMAGE,
        ])
    }

    _enrichSubclassContent = (content: Record<string, any>): void => {
        if (content.bio) {
            content.bio = content.bio.map((html: RawBlockText) =>
                htmlToEnrichedTextBlock(html.value)
            )
        }
        if (content.socials) {
            // We're parsing here an ArchieML array of objects outside of the
            // usual freeform array [+body]. This means we need to manually
            // reconstruct the {type, value} object created by freeform arrays
            // that parseSocials expects. Technically, we could just parse the
            // [socials] array without all the parseRawBlocksToEnrichedBlocks
            // machinery (like we dit above for the [bio] block), but this way
            // we benefit from features and the predictability of the regular
            // parsing pipeline. In particular, this gives us round trip testing
            // and the documenting of blocks in a consistent way, wihch is more
            // justifiable here compared to the bio block given the wider array
            // of edge cases for this block.
            content.socials = parseSocials({
                type: "socials",
                value: content.socials,
            })
        }
    }

    _validateSubclass = async (): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []
        if (!this.content.bio) {
            errors.push({
                type: OwidGdocErrorMessageType.Warning,
                property: "bio",
                message: "You might want to add a bio for this author.",
            })
        }
        if (!this.content.socials) {
            errors.push({
                type: OwidGdocErrorMessageType.Warning,
                property: "socials",
                message: "You might want to add socials for this author.",
            })
        }
        return errors
    }

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    static async getPublishedAuthors(
        knex: db.KnexReadWriteTransaction
    ): Promise<GdocAuthor[]> {
        return loadPublishedGdocAuthors(knex)
    }
}
