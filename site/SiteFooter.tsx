import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faRss } from "@fortawesome/free-solid-svg-icons"
import {
    ArchiveMetaInformation,
    SiteFooterContext,
} from "@ourworldindata/utils"
import { viteAssetsForSite } from "./viteUtils.js"
import { ScriptLoadErrorDetector } from "./NoJSDetector.js"
import { ABOUT_LINKS, PROD_URL, RSS_FEEDS, SOCIALS } from "./SiteConstants.js"
import { Button } from "@ourworldindata/components"
import { SITE_TOOLS_CLASS } from "./SiteTools.js"
import { OxfordAndGcdlLogos } from "./SiteLogos.js"
import { IS_ARCHIVE } from "../settings/clientSettings.js"
import { SEARCH_BASE_PATH } from "./search/searchUtils.js"

interface SiteFooterProps {
    hideDonate?: boolean
    hideDonationFlag?: boolean
    context?: SiteFooterContext
    debug?: boolean
    isPreviewing?: boolean
    archiveInfo?: ArchiveMetaInformation
}

const linkBaseUrl = IS_ARCHIVE ? PROD_URL : ""

type LinkData = { title: string; url: string }

const EXPLORE_LINKS: LinkData[] = [
    { title: "Topics", url: "/#all-topics" },
    { title: "Data", url: SEARCH_BASE_PATH },
    { title: "Insights", url: "/data-insights" },
]

const RESOURCE_LINKS: LinkData[] = [
    { title: "Latest Articles", url: "/latest" },
    { title: "SDG Tracker", url: "/sdgs" },
    { title: "Teaching with OWID", url: "/teaching" },
]

const LEGAL_LINKS: LinkData[] = [
    { title: "Privacy policy", url: "/privacy-policy" },
    { title: "Legal disclaimer", url: "/organization#legal-disclaimer" },
    {
        title: "Grapher license",
        url: "https://github.com/owid/owid-grapher/blob/master/LICENSE.md",
    },
]

const FooterLink = (props: LinkData) => {
    const url = props.url.startsWith("/")
        ? `${linkBaseUrl}${props.url}`
        : props.url

    return (
        <li>
            <a
                href={url}
                className="body-3-medium"
                data-track-note="footer_navigation"
            >
                {props.title}
            </a>
        </li>
    )
}

const FooterLinkList = (props: { links: LinkData[] }) => (
    <ul className="footer-link-list">
        {props.links.map((link) => (
            <FooterLink title={link.title} url={link.url} key={link.title} />
        ))}
    </ul>
)

const FooterLinkColumnsProd = () => (
    <div className="footer-right span-cols-6 span-sm-cols-12 col-start-8 col-sm-start-2 grid grid-cols-3 grid-sm-cols-2">
        <div className="footer-link-column">
            <h5 className="h5-black-caps">Explore</h5>
            <FooterLinkList links={EXPLORE_LINKS} />
            <h5 className="h5-black-caps">Resources</h5>
            <FooterLinkList links={RESOURCE_LINKS} />
        </div>
        <div className="footer-link-column">
            <h5 className="h5-black-caps">About</h5>
            <FooterLinkList links={ABOUT_LINKS} />
        </div>
        <div className="footer-link-column">
            <h5 className="h5-black-caps">
                <FontAwesomeIcon icon={faRss} />
                RSS Feeds
            </h5>
            <FooterLinkList links={RSS_FEEDS} />
        </div>
    </div>
)

const FooterLinkColumnsArchive = () => (
    <div className="footer-right span-cols-6 span-sm-cols-12 col-start-8 col-sm-start-2 grid grid-cols-2">
        <div className="footer-link-column">
            <h5 className="h5-black-caps">About the project</h5>
            <FooterLinkList links={ABOUT_LINKS} />
        </div>
        <div className="footer-link-column">
            <h5 className="h5-black-caps">Resources</h5>
            <FooterLinkList links={RESOURCE_LINKS} />
        </div>
    </div>
)

export const SiteFooter = (props: SiteFooterProps) => {
    const scripts: string[] = []
    if (props.archiveInfo)
        scripts.push(
            `window._OWID_ARCHIVE_INFO = ${JSON.stringify(props.archiveInfo)};`
        )

    scripts.push(
        `window.runSiteFooterScripts(${JSON.stringify({
            context: props.context,
            debug: props.debug,
            isPreviewing: props.isPreviewing,
            hideDonationFlag: props.hideDonationFlag,
        })});`
    )

    return (
        <>
            {!props.hideDonate && (
                <section className="donate-footer grid grid-cols-12-full-width">
                    <div className="donate-footer-inner span-cols-12 col-start-2">
                        <div>
                            <h4>
                                Our World in Data is free and accessible for
                                everyone.
                            </h4>
                            <p>Help us do this work by making a donation.</p>
                        </div>

                        <Button
                            href={`${linkBaseUrl}/donate`}
                            className="body-2-semibold donate-button"
                            dataTrackNote="donate_footer"
                            text="Donate now"
                            theme="solid-vermillion"
                            icon={null}
                        />
                    </div>
                </section>
            )}
            <footer className="site-footer grid grid-cols-12-full-width">
                <div className="footer-left span-cols-5 span-sm-cols-12 col-start-2 col-sm-start-2">
                    <p className="body-3-medium">
                        Our World in Data is a project of{" "}
                        <a href="https://global-change-data-lab.org/">
                            Global Change Data Lab
                        </a>
                        , a nonprofit based in the UK (Reg. Charity No.
                        1186433). Our charts, articles, and data are licensed
                        under{" "}
                        <a href="https://creativecommons.org/licenses/by/4.0/">
                            CC BY
                        </a>
                        , unless stated otherwise. Tools and software we develop
                        are open source under the{" "}
                        <a href="https://github.com/owid/owid-grapher/blob/master/LICENSE.md">
                            MIT license
                        </a>
                        . Third-party materials, including some charts and data,
                        are subject to third-party licenses. See our{" "}
                        <a href={`${linkBaseUrl}/faqs`}>FAQs</a> for more
                        details.
                    </p>
                    <div className="affiliates">
                        <div className="oxford-logos">
                            <OxfordAndGcdlLogos />
                        </div>
                        <a href="https://www.ycombinator.com">
                            <img
                                src={"/yc-logo.svg"}
                                alt="Y Combinator logo"
                                loading="lazy"
                                width={123}
                                height={30}
                            />
                        </a>
                    </div>
                </div>
                {props.archiveInfo ? (
                    <FooterLinkColumnsArchive />
                ) : (
                    <FooterLinkColumnsProd />
                )}
                <div className="footer-base span-cols-12 col-start-2 grid grid-cols-2 grid-sm-cols-1">
                    <div className="footer-base__socials">
                        <h5 className="h5-black-caps">Follow us</h5>
                        {SOCIALS.map((social) => (
                            <a
                                href={social.url}
                                key={social.url}
                                data-track-note="footer_social"
                            >
                                <FontAwesomeIcon icon={social.icon} />
                            </a>
                        ))}
                    </div>
                    <div className="footer-base__legal">
                        <FooterLinkList links={LEGAL_LINKS} />
                    </div>
                </div>

                <div className={SITE_TOOLS_CLASS} />
                {
                    viteAssetsForSite({
                        staticAssetMap: props.archiveInfo?.assets?.static,
                    }).forFooter
                }
                <ScriptLoadErrorDetector />
                <script
                    type="module"
                    dangerouslySetInnerHTML={{
                        __html: scripts.join("\n"),
                    }}
                />
            </footer>
        </>
    )
}
