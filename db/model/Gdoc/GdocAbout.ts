import {
    OwidGdocAboutContent,
    OwidGdocAboutInterface,
    OwidGdocBaseInterface,
} from "@ourworldindata/types"
import { traverseEnrichedBlock } from "@ourworldindata/utils"
import * as db from "../../db.js"
import { getPublicDonorNames } from "../Donor.js"
import { GdocBase } from "./GdocBase.js"

export class GdocAbout extends GdocBase implements OwidGdocAboutInterface {
    content!: OwidGdocAboutContent

    static create(obj: OwidGdocBaseInterface): GdocAbout {
        const gdoc = new GdocAbout(undefined)
        Object.assign(gdoc, obj)
        return gdoc
    }

    async _loadSubclassAttachments(
        knex: db.KnexReadonlyTransaction
    ): Promise<void> {
        let hasDonors = false
        for (const enrichedBlockSource of this.enrichedBlockSources) {
            for (const block of enrichedBlockSource) {
                traverseEnrichedBlock(block, (block) => {
                    if (block.type === "donors") {
                        hasDonors = true
                    }
                })
            }
        }
        if (hasDonors) {
            this.donors = await getPublicDonorNames(knex)
        }
    }
}
