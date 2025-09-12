import { viteAssetsForSite } from "./viteUtils.js"
import { GOOGLE_TAG_MANAGER_ID } from "../settings/clientSettings.js"
import { NoJSDetector } from "./NoJSDetector.js"
import {
    ArchiveContext,
    AssetMap,
    DEFAULT_THUMBNAIL_FILENAME,
} from "@ourworldindata/types"
import { parseArchivalDate } from "@ourworldindata/utils"

export const GTMScriptTags = ({ gtmId }: { gtmId: string }) => {
    if (!gtmId || /["']/.test(gtmId)) return null
    return (
        <>
            <script
                dangerouslySetInnerHTML={{
                    __html: `/* Prepare Google Tag Manager */
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag("consent","default",{"ad_storage":"denied","ad_user_data":"denied","ad_personalization":"denied","analytics_storage":"denied","wait_for_update":1000});
`,
                }}
            />
            <script
                dangerouslySetInnerHTML={{
                    __html: `/* Load Google Tag Manager */
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`,
                }}
            />
        </>
    )
}

export const Head = (props: {
    canonicalUrl: string
    pageTitle?: string
    pageDesc?: string
    imageUrl?: string
    children?: any
    baseUrl: string
    atom?: {
        title: string
        href: string
    }
    staticAssetMap?: AssetMap
    archiveContext?: ArchiveContext
}) => {
    const { canonicalUrl, baseUrl } = props
    const pageTitle = props.pageTitle || `Our World in Data`
    const fullPageTitle = props.pageTitle
        ? `${props.pageTitle} - Our World in Data`
        : `Our World in Data`
    const pageDesc =
        props.pageDesc ||
        "Research and data to make progress against the world’s largest problems"
    const imageUrl =
        props.imageUrl || `${baseUrl}/${DEFAULT_THUMBNAIL_FILENAME}`
    const atom = props.atom ?? {
        title: "Atom feed for Our World in Data",
        href: "/atom.xml",
    }

    const stylesheets = viteAssetsForSite({
        staticAssetMap: props.staticAssetMap,
    }).forHeader

    let archivalDateStr = undefined
    if (props.archiveContext?.archivalDate) {
        archivalDateStr = parseArchivalDate(props.archiveContext?.archivalDate)
            .utc()
            .format("YYYY-MM-DD")
    }

    return (
        <head>
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1, minimum-scale=1"
            />
            <title>{fullPageTitle}</title>
            <meta name="description" content={pageDesc} />
            <link rel="canonical" href={canonicalUrl} />
            <link
                rel="alternate"
                type="application/atom+xml"
                href={atom.href}
                title={atom.title}
            />
            {props.archiveContext && (
                <link
                    rel="archives"
                    href={props.archiveContext.archiveUrl}
                    title={`Archived version of this chart as of ${archivalDateStr}`}
                    data-archival-date={props.archiveContext.archivalDate}
                />
            )}
            <link
                rel="apple-touch-icon"
                sizes="180x180"
                href="/apple-touch-icon.png"
            />
            <link
                rel="preload"
                href="/fonts/LatoLatin-Regular.woff2"
                as="font"
                type="font/woff2"
                crossOrigin="anonymous"
            />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:title" content={pageTitle} />
            <meta property="og:description" content={pageDesc} />
            <meta property="og:image" content={encodeURI(imageUrl)} />
            <meta property="og:site_name" content="Our World in Data" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:site" content="@OurWorldInData" />
            <meta name="twitter:creator" content="@OurWorldInData" />
            <meta name="twitter:title" content={pageTitle} />
            <meta name="twitter:description" content={pageDesc} />
            <meta name="twitter:image" content={encodeURI(imageUrl)} />
            {stylesheets}
            {props.children}
            <NoJSDetector baseUrl={baseUrl} />
            <GTMScriptTags gtmId={GOOGLE_TAG_MANAGER_ID} />
        </head>
    )
}
