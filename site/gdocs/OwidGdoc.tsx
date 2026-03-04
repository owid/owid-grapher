import * as _ from "lodash-es"
import * as React from "react"
import { OwidGdocType, ArchiveContext } from "@ourworldindata/types"
import { OwidGdocPageProps } from "@ourworldindata/utils"
import { match, P } from "ts-pattern"
import { useIsClient } from "usehooks-ts"
import { GdocPost } from "./pages/GdocPost.js"
import { DataInsightPage } from "./pages/DataInsight.js"
import { Fragment } from "./pages/Fragment.js"
import { Homepage } from "./pages/Homepage.js"
import { Author } from "./pages/Author.js"
import AboutPage from "./pages/AboutPage.js"
import { AttachmentsContext } from "./AttachmentsContext.js"
import { DocumentContext } from "./DocumentContext.js"
import { AnnouncementPage } from "./pages/Announcement.js"
import { Profile } from "./pages/Profile.js"
import { ADMIN_BASE_URL } from "../../settings/clientSettings.js"
import { CookieKey } from "@ourworldindata/grapher"

type OwidGdocProps = OwidGdocPageProps & {
    isPreviewing?: boolean
    archiveContext?: ArchiveContext
}

function hasAdminCookie(): boolean {
    try {
        return document.cookie.includes(CookieKey.isAdmin)
    } catch {
        return false
    }
}

function AdminLinks({ id }: Pick<OwidGdocPageProps, "id">) {
    const isClient = useIsClient()
    if (!isClient || !id || !hasAdminCookie()) return null

    return (
        <div className="gdoc-admin-bar">
            <a
                href={`https://docs.google.com/document/d/${id}/edit`}
                id="gdoc-link"
                target="_blank"
                rel="noopener"
            >
                Gdoc
            </a>
            <span>/</span>
            <a
                href={`${ADMIN_BASE_URL}/admin/gdocs/${id}/preview`}
                id="admin-link"
                target="_blank"
                rel="noopener"
            >
                Admin
            </a>
        </div>
    )
}

export function OwidGdoc({
    isPreviewing = false,
    archiveContext,
    ...props
}: OwidGdocProps): React.ReactElement {
    const content = match(props)
        .with(
            {
                content: {
                    type: P.union(
                        OwidGdocType.Article,
                        OwidGdocType.TopicPage,
                        OwidGdocType.LinearTopicPage
                    ),
                },
            },
            (props) => <GdocPost {...props} />
        )
        .with({ content: { type: OwidGdocType.AboutPage } }, (props) => (
            <AboutPage {...props} />
        ))
        .with({ content: { type: OwidGdocType.DataInsight } }, (props) => (
            <DataInsightPage {...props} />
        ))
        .with({ content: { type: OwidGdocType.Announcement } }, (props) => (
            <AnnouncementPage {...props} />
        ))
        .with({ content: { type: OwidGdocType.Homepage } }, (props) => (
            <Homepage {...props} />
        ))
        .with({ content: { type: OwidGdocType.Author } }, (props) => (
            <Author {...props} />
        ))
        .with({ content: { type: OwidGdocType.Fragment } }, (props) => (
            <Fragment {...props} />
        ))
        .with({ content: { type: OwidGdocType.Profile } }, (props) => (
            <Profile {...props} />
        ))
        .with(P.any, (gdoc) => (
            <div
                className="grid grid-cols-12-full-width"
                style={{ height: 250 }}
            >
                <h3 className="span-cols-12 col-start-2">
                    Unknown article type: "{gdoc.content?.type}"
                </h3>
                <p className="span-cols-12 col-start-2">
                    Must be one of: {Object.values(OwidGdocType).join(", ")}
                </p>
            </div>
        ))
        .run()

    return (
        <AttachmentsContext.Provider
            value={{
                donors: _.get(props, "donors", []),
                linkedAuthors: _.get(props, "linkedAuthors", []),
                linkedDocuments: _.get(props, "linkedDocuments", {}),
                imageMetadata: _.get(props, "imageMetadata", {}),
                linkedCharts: _.get(props, "linkedCharts", {}),
                linkedIndicators: _.get(props, "linkedIndicators", {}),
                relatedCharts: _.get(props, "relatedCharts", []),
                latestDataInsights: _.get(props, "latestDataInsights", []),
                homepageMetadata: _.get(props, "homepageMetadata", {}),
                latestWorkLinks: _.get(props, "latestWorkLinks", []),
                linkedNarrativeCharts: _.get(
                    props,
                    "linkedNarrativeCharts",
                    {}
                ),
                linkedStaticViz: _.get(props, "linkedStaticViz", {}),
                linkedCallouts: _.get(props, "linkedCallouts", {}),
                // lodash doesn't use fallback when value is null
                tags: props.tags ?? [],
            }}
        >
            <DocumentContext.Provider value={{ isPreviewing, archiveContext }}>
                <AdminLinks id={props.id} />
                {content}
            </DocumentContext.Provider>
        </AttachmentsContext.Provider>
    )
}
