import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faRss } from "@fortawesome/free-solid-svg-icons"
import { SiteFooterContext } from "@ourworldindata/utils"
import { viteAssetsForSite } from "./viteUtils.js"
import { ScriptLoadErrorDetector } from "./NoJSDetector.js"
import { ABOUT_LINKS, RSS_FEEDS, SOCIALS } from "./SiteConstants.js"

interface SiteFooterProps {
    hideDonate?: boolean
    hideDonationFlag?: boolean
    baseUrl: string
    context?: SiteFooterContext
    debug?: boolean
    isPreviewing?: boolean
}

type LinkData = { title: string; url: string }

const EXPLORE_LINKS: LinkData[] = [
    { title: "Topics", url: "/#all-topics" },
    { title: "Data", url: "/data" },
    { title: "Insights", url: "/data-insights" },
]

const RESOURCE_LINKS: LinkData[] = [
    { title: "Latest Articles", url: "/latest" },
    { title: "SDG Trackers", url: "/sdgs" },
    { title: "Teaching Materials", url: "/teaching" },
]

const LEGAL_LINKS: LinkData[] = [
    { title: "Privacy policy", url: "/privacy" },
    { title: "Legal disclaimer", url: "/organization#legal-disclaimer" },
    {
        title: "Grapher license",
        url: "https://github.com/owid/owid-grapher/blob/master/LICENSE.md",
    },
]

const FooterLink = (props: LinkData) => (
    <li>
        <a
            href={props.url}
            className="body-3-medium"
            data-track-note="footer_navigation"
        >
            {props.title}
        </a>
    </li>
)

const FooterLinkList = (props: { links: LinkData[] }) => (
    <ul className="footer-link-list">
        {props.links.map((link) => (
            <FooterLink title={link.title} url={link.url} key={link.title} />
        ))}
    </ul>
)

export const SiteFooter = (props: SiteFooterProps) => (
    <>
        {!props.hideDonate && (
            <section className="donate-footer grid grid-cols-12-full-width">
                <div className="donate-footer-inner span-cols-12 col-start-2">
                    <div>
                        <h4 className="h2-bold">
                            Our World in Data is free and accessible for
                            everyone.
                        </h4>
                        <p className="body-1-regular">
                            Help us do this work by making a donation.
                        </p>
                    </div>

                    <a
                        href="/donate"
                        className="owid-button donate-button"
                        data-track-note="donate_footer"
                    >
                        Donate now
                    </a>
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
                    , a nonprofit based in the UK (Reg. Charity No. 1186433).
                    Our charts, articles, and data are licensed under{" "}
                    <a href="https://creativecommons.org/licenses/by/4.0/">
                        CC BY
                    </a>
                    , unless stated otherwise. Tools and software we develop are
                    open source under the{" "}
                    <a href="https://github.com/owid/owid-grapher/blob/master/LICENSE.md">
                        MIT license
                    </a>
                    . Third-party materials, including some charts and data, are
                    subject to third-party licenses. See our{" "}
                    <a href={`${props.baseUrl}/faqs`}>FAQs</a> for more details.
                </p>
                <div className="affiliates">
                    <div className="oxford-logos">
                        <a href="https://www.oxfordmartin.ox.ac.uk/global-development">
                            <img
                                src={`${props.baseUrl}/oms-logo.svg`}
                                alt="Oxford Martin School logo"
                                loading="lazy"
                                width="58"
                                height="62"
                            />
                        </a>
                        <a href="https://www.ox.ac.uk">
                            <img
                                src={`${props.baseUrl}/oxford-logo.svg`}
                                alt="University of Oxford logo"
                                loading="lazy"
                                width="58"
                                height="62"
                            />
                        </a>
                        <a href="https://global-change-data-lab.org">
                            <img
                                src={`${props.baseUrl}/gcdl-logo.svg`}
                                alt="Global Change Data Lab logo"
                                loading="lazy"
                                width="106"
                                height="62"
                            />
                        </a>
                    </div>
                    <a href="https://www.ycombinator.com">
                        <img
                            src={`${props.baseUrl}/yc-logo.svg`}
                            alt="Y Combinator logo"
                            loading="lazy"
                            width="123"
                            height="30"
                        />
                    </a>
                </div>
            </div>
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

            <div className="site-tools" />
            {viteAssetsForSite().forFooter}
            <ScriptLoadErrorDetector />
            <script
                type="module"
                dangerouslySetInnerHTML={{
                    __html: `window.runSiteFooterScripts(${JSON.stringify({
                        context: props.context,
                        debug: props.debug,
                        isPreviewing: props.isPreviewing,
                        hideDonationFlag: props.hideDonationFlag,
                    })})`,
                }}
            />
        </footer>
    </>
)
