import { Entity, Column } from "typeorm"
import {
    OwidGdocErrorMessage,
    OwidGdocAuthorInterface,
    OwidGdocAuthorContent,
    RawBlockText,
    OwidEnrichedGdocBlock,
    OwidGdocErrorMessageType,
} from "@ourworldindata/utils"
import { GdocBase } from "./GdocBase.js"
import { htmlToEnrichedTextBlock } from "./htmlToEnriched.js"
import { parseSocials } from "./rawToEnriched.js"

@Entity("posts_gdocs")
export class GdocAuthor extends GdocBase implements OwidGdocAuthorInterface {
    @Column({ default: "{}", type: "json" })
    content!: OwidGdocAuthorContent

    constructor(id?: string) {
        super(id)
    }
    _filenameProperties: string[] = ["featured-image"]

    _getSubclassEnrichedBlocks = (gdoc: this): OwidEnrichedGdocBlock[] => {
        const blocks: OwidEnrichedGdocBlock[] = []

        if (gdoc.content.socials) blocks.push(gdoc.content.socials)
        if (gdoc.content.bio) blocks.push(...gdoc.content.bio)

        return blocks
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
}
