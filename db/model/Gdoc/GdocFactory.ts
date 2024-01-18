import { get } from "lodash"
import { match, P } from "ts-pattern"
import {
    GdocsContentSource,
    OwidGdoc,
    OwidGdocType,
    checkIsOwidGdocType,
} from "@ourworldindata/utils"

import { GdocBase, Tag } from "./GdocBase.js"
import { GdocPost } from "./GdocPost.js"
import { GdocDataInsight } from "./GdocDataInsight.js"
import { GdocHomepage } from "./GdocHomepage.js"

// Handles the registration and loading of Gdocs
// Couldn't put this in GdocBase because of circular dependency issues
export class GdocFactory {
    static fromJSON(json: Record<string, any>): GdocPost | GdocDataInsight {
        if (typeof json.content === "string") {
            json.content = JSON.parse(json.content)
        }
        const type = json.content.type as OwidGdocType | undefined
        const id = json.id as string
        if (!type) {
            throw new Error(
                `Database record for Google Doc with id "${id}" has no type`
            )
        }

        json.createdAt = new Date(json.createdAt)
        json.publishedAt = json.publishedAt ? new Date(json.publishedAt) : null
        json.updatedAt = new Date(json.updatedAt)

        // `tags` ordinarily gets populated via a join table in .load(), for our purposes we don't need it here
        // except for the fact that loadRelatedCharts() assumes the array exists
        const tags = Tag.create(json.tags)
        json.tags = tags

        return match(type)
            .with(
                P.union(
                    OwidGdocType.Article,
                    OwidGdocType.LinearTopicPage,
                    OwidGdocType.TopicPage,
                    OwidGdocType.Fragment
                ),
                // TODO: better validation here?
                () => GdocPost.create({ ...(json as any) })
            )
            .with(
                OwidGdocType.DataInsight,
                // TODO: better validation here?
                () => GdocDataInsight.create({ ...(json as any) })
            )
            .with(
                OwidGdocType.Homepage,
                // TODO: better validation here?
                () => GdocHomepage.create({ ...(json as any) })
            )
            .exhaustive()
    }

    static async create(id: string): Promise<OwidGdoc> {
        // Fetch the data from Google Docs and save it to the database
        // We have to fetch it here because we need to know the type of the Gdoc in this.load()
        const base = new GdocBase(id)
        await base.fetchAndEnrichGdoc()
        await base.save()

        // Load its metadata and state so that subclass parsing & validation is also done.
        // This involves a second call to the DB and Google, which makes me sad, but it'll do for now.
        const gdoc = await this.load(id, GdocsContentSource.Gdocs)

        await gdoc.save()

        return gdoc
    }

    static async loadBySlug(
        slug: string
    ): Promise<GdocPost | GdocDataInsight | GdocHomepage> {
        const base = await GdocBase.findOne({
            where: { slug, published: true },
        })
        if (!base) {
            throw new Error(
                `No published Google Doc with slug "${slug}" found in the database`
            )
        }
        return this.load(base.id)
    }

    // From an ID, get a Gdoc object with all its metadata and state loaded, in its correct subclass.
    // If contentSource is Gdocs, use live data from Google, otherwise use the data in the DB.
    static async load(
        id: string,
        contentSource?: GdocsContentSource
    ): Promise<GdocPost | GdocDataInsight | GdocHomepage> {
        const base = await GdocBase.findOne({
            where: {
                id,
            },
            relations: ["tags"],
        })
        if (!base)
            throw new Error(
                `No Google Doc with id "${id}" found in the database`
            )

        const type = get(base, "content.type") as unknown
        if (!type)
            throw new Error(
                `Database record for Google Doc with id "${id}" has no type`
            )
        if (!checkIsOwidGdocType(type)) {
            throw new Error(
                `Database record for Google Doc with id "${id}" has invalid type "${type}"`
            )
        }

        const gdoc = match(type)
            .with(
                P.union(
                    OwidGdocType.Article,
                    OwidGdocType.LinearTopicPage,
                    OwidGdocType.TopicPage,
                    OwidGdocType.Fragment
                ),
                () => GdocPost.create(base)
            )
            .with(OwidGdocType.DataInsight, () => GdocDataInsight.create(base))
            .with(OwidGdocType.Homepage, () => GdocHomepage.create(base))
            .exhaustive()

        if (contentSource === GdocsContentSource.Gdocs) {
            await gdoc.fetchAndEnrichGdoc()
        }

        await gdoc.loadState()

        return gdoc
    }
}
