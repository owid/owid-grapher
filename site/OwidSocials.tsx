import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { RSS_FEEDS, SOCIALS } from "./SiteConstants.js"
import { NewsletterSubscriptionContext } from "./newsletter.js"

export const OwidSocials = ({
    includeRss = false,
    context,
}: {
    includeRss?: boolean
    context: NewsletterSubscriptionContext
}) => {
    const items = includeRss ? [...SOCIALS, ...RSS_FEEDS] : SOCIALS
    return (
        <div className="owid-socials">
            <p className="owid-socials__heading">Follow us</p>
            <ul className="owid-socials__list">
                {items.map(({ title, url, icon }) => (
                    <li className="owid-socials__item" key={title}>
                        <a
                            className="owid-socials__link"
                            href={url}
                            title={title}
                            rel="noopener"
                            data-track-note={context}
                        >
                            <FontAwesomeIcon
                                className="owid-socials__label-icon"
                                icon={icon}
                            />
                            <span className="owid-socials__label">{title}</span>
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    )
}
