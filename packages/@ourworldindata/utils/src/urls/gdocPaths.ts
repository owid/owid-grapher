import { OwidGdocType } from "@ourworldindata/types"
import { P, match } from "ts-pattern"

/** The path a gdoc bakes to, after `prefix` (a base URL, a directory, or ""). */
export function getPrefixedGdocPath(
    prefix: string,
    gdoc: { slug: string; content: { type?: OwidGdocType } }
): string {
    return match(gdoc)
        .with(
            {
                content: { type: OwidGdocType.Homepage },
            },
            () => prefix
        )
        .with(
            {
                content: {
                    type: P.union(
                        OwidGdocType.Article,
                        OwidGdocType.TopicPage,
                        OwidGdocType.LinearTopicPage,
                        OwidGdocType.AboutPage,
                        OwidGdocType.Announcement
                    ),
                },
            },
            () => `${prefix}/${gdoc.slug}`
        )
        .with(
            {
                content: { type: OwidGdocType.Profile },
            },
            () => `${prefix}/profile/${gdoc.slug}`
        )
        .with(
            {
                content: { type: OwidGdocType.DataInsight },
            },
            () => `${prefix}/data-insights/${gdoc.slug}`
        )
        .with(
            {
                content: { type: OwidGdocType.Author },
            },
            () => `${prefix}/team/${gdoc.slug}`
        )
        .with(
            {
                content: {
                    type: P.optional(P.union(OwidGdocType.Fragment)),
                },
            },
            () => ""
        )
        .exhaustive()
}
