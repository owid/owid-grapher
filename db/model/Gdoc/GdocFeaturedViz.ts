import {
    OwidGdocBaseInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocFeaturedVizContent,
    OwidGdocFeaturedVizInterface,
    excludeNullish,
} from "@ourworldindata/utils"
import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { GdocBase } from "./GdocBase.js"

export class GdocFeaturedViz
    extends GdocBase
    implements OwidGdocFeaturedVizInterface
{
    declare content: OwidGdocFeaturedVizContent

    constructor(id?: string) {
        super(id)
    }

    protected override typeSpecificFilenames(): string[] {
        return excludeNullish([this.content["featured-image"]])
    }

    override _getSubclassEnrichedBlocks = (
        gdoc: this
    ): OwidEnrichedGdocBlock[] => {
        if (!gdoc.content.refs?.definitions) return []
        return Object.values(gdoc.content.refs.definitions).flatMap(
            (definition) => definition.content
        )
    }

    override _validateSubclass = async (): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []

        // Featured viz pages must have a bespoke-component block at the top level of their body
        const hasBespokeBlock = (this.content.body ?? []).some(
            (block) => block.type === "bespoke-component"
        )

        if (!hasBespokeBlock) {
            errors.push({
                property: "body",
                message:
                    "A featured viz page must contain a {.bespoke-component} block at the top level of its body",
                type: OwidGdocErrorMessageType.Error,
            })
        }

        return errors
    }

    static create(obj: OwidGdocBaseInterface): GdocFeaturedViz {
        const gdoc = new GdocFeaturedViz(undefined)
        Object.assign(gdoc, obj)
        return gdoc
    }
}
