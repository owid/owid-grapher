import { useEffect, useState } from "react"
import * as React from "react"
import cx from "clsx"
import { faTimes, faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { SiteAnalytics } from "./SiteAnalytics.js"
import { TextInput } from "@ourworldindata/components"
import { NewsletterSubscriptionContext } from "./newsletter.js"
import { NewsletterIcon } from "./gdocs/components/NewsletterIcon.js"

const analytics = new SiteAnalytics()

// The only two Mailchimp interest-group ids we have. They are cadence options
// within group category 85302 of a single audience; no per-topic-area group,
// segment or tag exists, so nothing here can register a "follow this area".
const DATA_INSIGHTS = "16"
const BIWEEKLY = "2"

export const NewsletterSubscription = ({
    context,
}: {
    context:
        | NewsletterSubscriptionContext.Homepage
        | NewsletterSubscriptionContext.Floating
}) => {
    const [isOpen, setIsOpen] = useState(false)

    const subscribeText = "Subscribe"

    return (
        <div className={`newsletter-subscription${isOpen ? " active" : ""}`}>
            {isOpen && (
                <>
                    <div
                        className="overlay"
                        onClick={() => {
                            setIsOpen(false)
                        }}
                    />
                    <div className="box">
                        <NewsletterSubscriptionHeader />
                        <NewsletterSubscriptionForm context={context} />
                    </div>
                </>
            )}
            {isOpen ? (
                <button
                    aria-label="Close subscription form"
                    className="prompt"
                    onClick={() => setIsOpen(false)}
                >
                    <FontAwesomeIcon icon={faTimes} /> Close
                </button>
            ) : (
                <button
                    aria-label={subscribeText}
                    className="prompt"
                    data-track-note="dialog_open_newsletter"
                    onClick={() => {
                        setIsOpen(!isOpen)
                    }}
                >
                    <FontAwesomeIcon icon={faEnvelopeOpenText} />
                    {subscribeText}
                </button>
            )}
        </div>
    )
}

export const NewsletterSubscriptionHeader = ({
    showSubheading = false,
}: {
    showSubheading?: boolean
}) => {
    return (
        <div className="newsletter-subscription-header">
            <NewsletterIcon className="newsletter-subscription-header__icon" />
            <h4 className="newsletter-subscription-header__heading h3-bold">
                Subscribe to our newsletters
            </h4>
            {showSubheading && (
                <span className="newsletter-subscription-header__subheading">
                    Receive our latest work by email
                </span>
            )}
        </div>
    )
}

export const NewsletterSubscriptionForm = ({
    context,
    className = "",
    topicArea,
}: {
    context: NewsletterSubscriptionContext
    className?: string
    /**
     * Only read in the Latest context: the top-level topic area the visitor has
     * filtered /latest to, if any. Surfaces the area name in the "Follow Topics"
     * row and pre-checks it.
     */
    topicArea?: string
}) => {
    // On /latest the second row is presented as "Follow Topics" instead of the
    // Data Insights newsletter, and only The OWID Brief is on by default.
    const isLatest = context === NewsletterSubscriptionContext.Latest

    const idDataInsights = `mce-group[85302]-85302-0${
        context ? "-" + context : ""
    }`
    const idBiweekly = `mce-group[85302]-85302-1${context ? "-" + context : ""}`
    // Deliberately not an `mce-group[…]` id: this control posts nothing.
    const idFollowTopics = `newsletter-follow-topics${
        context ? "-" + context : ""
    }`

    // Real Mailchimp interest groups that will be submitted. On /latest only
    // The OWID Brief can ever be in here — "Follow Topics" is tracked
    // separately because it maps to no group (see `followsTopics` below).
    const [frequencies, setFrequencies] = useState<string[]>(() =>
        isLatest ? [BIWEEKLY] : [DATA_INSIGHTS, BIWEEKLY]
    )

    // UI-only state for the inert "Follow Topics" control on /latest. It is
    // NOT part of `frequencies`, so it never contributes to the POST.
    const [followsTopics, setFollowsTopics] = useState<boolean>(
        () => isLatest && !!topicArea
    )

    // Unchanged rule: at least one real interest group must be selected. We
    // don't depend on how Mailchimp treats a group-less POST (it may create a
    // bare subscriber who then receives nothing) — the form simply never sends
    // one. On /latest that means The OWID Brief: ticking only the inert "Follow
    // Topics" leaves nothing to submit and the button stays disabled, which is
    // the honest outcome, and better than signing someone up to a list they
    // did not ask for.
    const isSubmittable = frequencies.length !== 0

    // Filtering /latest to a topic area is a statement of interest in it, so
    // pre-tick "Follow Topics". Deliberately one-way: we never untick it again
    // (and never touch The OWID Brief), so a deliberate choice by the visitor
    // survives later filter changes.
    useEffect(() => {
        if (!isLatest || !topicArea) return
        setFollowsTopics(true)
    }, [isLatest, topicArea])

    const secondGroup = isLatest
        ? {
              title: "Follow Topics",
              // TODO: static hint text for now — the actual cadence options are
              // pending a product decision, so there is no selector yet.
              frequency: "Pick your cadence",
              text: "Receive updates on the topics you follow as we publish them, at your preferred frequency.",
          }
        : {
              title: "Data Insights",
              frequency: "Every few days",
              text: "Receive our bite-sized insights on how the world is changing, every few days.",
          }

    const updateFrequencies = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setFrequencies([e.target.value, ...frequencies])
        } else {
            setFrequencies(
                frequencies.filter((frequency) => frequency !== e.target.value)
            )
        }
    }

    return (
        <form
            className={cx("newsletter-subscription-form", className)}
            action="https://ourworldindata.us8.list-manage.com/subscribe/post?u=18058af086319ba6afad752ec&id=2e166c1fc1"
            method="post"
            id="mc-embedded-subscribe-banner"
            name="mc-embedded-subscribe-banner"
            onSubmit={() =>
                analytics.logSiteFormSubmit(
                    "newsletter-subscribe",
                    `Subscribe [${context ?? "other-contexts"}]`
                )
            }
        >
            <img
                alt=""
                className="newsletter-subscription-form__checkbox-image"
                src="/images/biweekly-newsletter.webp"
                width={1200}
                height={630}
            />
            <div className="newsletter-subscription-form__checkbox">
                <input
                    type="checkbox"
                    value={BIWEEKLY}
                    name={`group[85302][${BIWEEKLY}]`}
                    id={idBiweekly}
                    checked={frequencies.includes(BIWEEKLY)}
                    onChange={updateFrequencies}
                />
                <label htmlFor={idBiweekly}>
                    <span className="newsletter-subscription-form__label-title">
                        The OWID Brief
                    </span>{" "}
                    <span className="newsletter-subscription-form__label-frequency note-12-medium">
                        Twice a month
                    </span>
                    <div className="newsletter-subscription-form__label-text">
                        Stay up to date with our latest work plus curated
                        highlights from across Our World in Data, twice a month.
                    </div>
                </label>
                <a
                    className="newsletter-subscription-form__example-link note-12-medium"
                    href="https://mailchi.mp/ourworldindata/owid-brief-2025-11-14"
                >
                    See example OWID Brief newsletter
                </a>
            </div>
            <img
                alt=""
                className="newsletter-subscription-form__checkbox-image"
                src="/images/data-insights.webp"
                width={1200}
                height={630}
            />
            <div className="newsletter-subscription-form__checkbox">
                {isLatest ? (
                    /*
                     * INTENTIONALLY INERT — do not give this a `name`.
                     *
                     * "Follow Topics" has no Mailchimp interest group: per-area
                     * groups do not exist yet (see site/topicNewsletter.ts).
                     * With no `name` the browser submits nothing for it, so
                     * ticking it has no effect on the subscription.
                     *
                     * Do NOT "fix" this by pointing it at an existing group.
                     * group[85302][16] is the Data Insights newsletter — wiring
                     * it here would silently subscribe people to a different
                     * newsletter from the one this label promises. Leave it
                     * inert until a real per-area group exists, then wire it to
                     * that.
                     */
                    <input
                        type="checkbox"
                        id={idFollowTopics}
                        checked={followsTopics}
                        onChange={(e) => setFollowsTopics(e.target.checked)}
                    />
                ) : (
                    <input
                        type="checkbox"
                        value={DATA_INSIGHTS}
                        name={`group[85302][${DATA_INSIGHTS}]`}
                        id={idDataInsights}
                        checked={frequencies.includes(DATA_INSIGHTS)}
                        onChange={updateFrequencies}
                    />
                )}
                <label htmlFor={isLatest ? idFollowTopics : idDataInsights}>
                    <span className="newsletter-subscription-form__label-title">
                        {secondGroup.title}
                    </span>{" "}
                    <span className="newsletter-subscription-form__label-frequency note-12-medium">
                        {secondGroup.frequency}
                    </span>
                    <div className="newsletter-subscription-form__label-text">
                        {secondGroup.text}
                    </div>
                    {isLatest && topicArea && (
                        <div className="newsletter-subscription-form__followed-topic note-12-medium">
                            Following {topicArea}
                        </div>
                    )}
                </label>
                {/* No example issue exists for "Follow Topics", so the link is
                    only meaningful for the Data Insights framing. */}
                {!isLatest && (
                    <a
                        className="newsletter-subscription-form__example-link note-12-medium"
                        href="https://us8.campaign-archive.com/?u=18058af086319ba6afad752ec&id=fdf16136e1"
                    >
                        See example Data Insights newsletter
                    </a>
                )}
            </div>
            {frequencies.length === 0 && (
                <div className="newsletter-subscription-form__alert">
                    {isLatest && followsTopics
                        ? // Ticking only "Follow Topics" leaves nothing to
                          // submit, so say why rather than asking for "at
                          // least one option" when a box is visibly ticked.
                          "Following topics is not available yet — select The OWID Brief to subscribe."
                        : "Please select at least one option."}
                </div>
            )}
            <div className="newsletter-subscription-form__email-submit">
                <TextInput
                    placeholder="Your email address"
                    type="email"
                    className="newsletter-subscription-form__email sentry-mask"
                    name="EMAIL"
                    required={true}
                />
                <button
                    aria-label="Subscribe to newsletter"
                    disabled={!isSubmittable}
                    onClick={() =>
                        analytics.logSiteClick(
                            "newsletter-subscribe",
                            `Subscribe [${context ?? "other-contexts"}]`
                        )
                    }
                    className="newsletter-subscription-form__submit"
                >
                    Subscribe
                </button>
            </div>
            {/* This hidden field should not be the last element in the form as long as we use the row-gap mixin
            to space elements vertically. When placed as the last element of the form, this hidden element becomes
            the target of the :last-child selector of the row-gap mixin, when it should be applied to the last visible
            element instead */}
            <input
                type="hidden"
                name="b_18058af086319ba6afad752ec_2e166c1fc1"
                tabIndex={-1}
            />
            <div className="newsletter-subscription-form__privacy-notice">
                By subscribing you are agreeing to the terms of our{" "}
                <a href="/privacy-policy">privacy policy</a>.
            </div>
        </form>
    )
}
