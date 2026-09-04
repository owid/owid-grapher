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

export const SubscribeFlow = ({
    topicAreaNames,
}: {
    topicAreaNames: string[]
}) => {
    const [state, setState] = useState<SubscribeFlowState>({ name: "form" })

    return match(state)
        .with({ name: "form" }, () => (
            <SiteQueryClientProvider>
                <SubscribeFormScreen
                    topicAreaNames={topicAreaNames}
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
                    href="/preferences"
                    text="Update your preferences"
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
        {followTopics && (
            <p className="subscribe-page__confirmation-text">
                We have sent a confirmation email to <strong>{email}</strong>{" "}
                with a summary of your preferences.
            </p>
        )}
        {subscribeToOwidBrief && (
            <p className="subscribe-page__confirmation-text">
                Your subscription to The OWID Brief is active.
            </p>
        )}
    </>
)

const SubscribeFormScreen = ({
    topicAreaNames,
    onSubscribed,
}: {
    topicAreaNames: string[]
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
                <EmailNotificationsSubscribeForm
                    topicAreaNames={topicAreaNames}
                    onSubscribed={onSubscribed}
                />
            </div>
            <aside className="subscribe-page__aside span-cols-3 col-start-11 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2">
                <p className="subscribe-page__aside-heading h6-black-caps">
                    Already subscribed?
                </p>
                <a className="subscribe-page__manage-link" href="/preferences">
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
