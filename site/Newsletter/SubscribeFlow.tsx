import { useState } from "react"
import cx from "clsx"
import { match } from "ts-pattern"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { Button } from "@ourworldindata/components"
import {
    EmailNotificationsSubscribeForm,
    Subscription,
} from "./EmailNotificationsSubscribeForm.js"
import { OwidSocials } from "../OwidSocials.js"
import { NewsletterSubscriptionContext } from "../newsletter.js"
import { SiteQueryClientProvider } from "../SiteQueryClientProvider.js"
import {
    SUBSCRIBE_PAGE_CONTENT_GRID_CLASSES,
    SubscribePageConfirmation,
    SubscribePageHero,
} from "./SubscribePageLayout.js"

type SubscribeFlowState =
    | { name: "form" }
    | { name: "success"; subscription: Subscription }

export const SubscribeFlow = () => {
    const [state, setState] = useState<SubscribeFlowState>({ name: "form" })

    return match(state)
        .with({ name: "form" }, () => (
            <SiteQueryClientProvider>
                <SubscribeFormScreen
                    onSubscribed={(subscription) =>
                        setState({ name: "success", subscription })
                    }
                />
            </SiteQueryClientProvider>
        ))
        .with({ name: "success" }, ({ subscription }) => (
            <SubscribePageConfirmation heading="You are now subscribed">
                <SubscribedText subscription={subscription} />
                <Button
                    className="subscribe-page__confirmation-action"
                    theme="outline-vermillion"
                    href="/latest"
                    text="Read our latest work"
                    icon={null}
                />
            </SubscribePageConfirmation>
        ))
        .exhaustive()
}

const SubscribedText = ({
    subscription: { email, followTopics, subscribeToOwidBrief },
}: {
    subscription: Subscription
}) => (
    <>
        <p className="subscribe-page__confirmation-text">
            We have subscribed <strong>{email}</strong> to{" "}
            {followTopics && subscribeToOwidBrief
                ? "topic notifications and The OWID Brief"
                : followTopics
                  ? "topic notifications"
                  : "The OWID Brief"}
            {followTopics
                ? ", and sent a confirmation email with a summary of your preferences."
                : "."}
        </p>
        {/* The public API doesn't say whether Mailchimp needs a re-subscriber
            to confirm (so it doesn't reveal the address's history), hence the
            hedge for everyone who picked the Brief. */}
        {subscribeToOwidBrief && (
            <p className="subscribe-page__confirmation-text">
                If you unsubscribed from The OWID Brief before, Mailchimp will
                email you to confirm.
            </p>
        )}
    </>
)

const SubscribeFormScreen = ({
    onSubscribed,
}: {
    onSubscribed: (subscription: Subscription) => void
}) => {
    return (
        <>
            <SubscribePageHero
                heading="Subscribe to our newsletters"
                subheading="Receive our latest work by email."
            />
            <div
                className={cx(
                    "subscribe-page__content",
                    SUBSCRIBE_PAGE_CONTENT_GRID_CLASSES
                )}
            >
                <EmailNotificationsSubscribeForm onSubscribed={onSubscribed} />
            </div>
            <aside className="subscribe-page__aside span-cols-3 col-start-11 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2">
                <p className="subscribe-page__aside-heading h6-black-caps">
                    Already subscribed?
                </p>
                <a
                    className="subscribe-page__manage-link"
                    href="/preferences"
                    data-track-note="subscribe_page_update_preferences"
                >
                    Update your preferences{" "}
                    <FontAwesomeIcon icon={faArrowRight} />
                </a>
            </aside>
            <hr className="subscribe-page__divider span-cols-12 col-start-2" />
            <div
                className={cx(
                    "subscribe-page__socials",
                    SUBSCRIBE_PAGE_CONTENT_GRID_CLASSES
                )}
            >
                <OwidSocials
                    includeRss
                    context={NewsletterSubscriptionContext.SubscribePage}
                />
            </div>
        </>
    )
}
