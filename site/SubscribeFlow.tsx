import { useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { TagGraphRoot } from "@ourworldindata/types"
import { EmailNotificationsSubscribeForm } from "./EmailNotificationsSubscribeForm.js"
import { OwidSocials } from "./OwidSocials.js"
import { NewsletterSubscriptionContext } from "./newsletter.js"
import {
    SUBSCRIBE_PAGE_CONTENT_GRID_CLASSES,
    SubscribePageConfirmation,
    SubscribePageHero,
} from "./SubscribePageLayout.js"

/**
 * Which screen the subscribe page shows. Everything that differs between
 * screens - the hero, the aside, the socials - lives inside this component,
 * because it is the page's hydration root (SUBSCRIBE_PAGE_ROOT_ID); the rest of
 * the page stays baked.
 */
type SubscribeFlowState = { name: "form" } | { name: "success"; email: string }

export const SubscribeFlow = ({
    topicTagGraph,
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const [state, setState] = useState<SubscribeFlowState>({ name: "form" })

    switch (state.name) {
        case "form":
            return (
                <SubscribeFormScreen
                    topicTagGraph={topicTagGraph}
                    onSubscribed={(email) =>
                        setState({ name: "success", email })
                    }
                />
            )
        case "success":
            return (
                <SubscribePageConfirmation
                    heading="You are now subscribed"
                    action={{
                        href: "/subscribe/preferences",
                        label: "Update your preferences",
                    }}
                >
                    We have sent a confirmation email to{" "}
                    <strong>{state.email}</strong> with a summary of your
                    preferences.
                </SubscribePageConfirmation>
            )
    }
}

const SubscribeFormScreen = ({
    topicTagGraph,
    onSubscribed,
}: {
    topicTagGraph: TagGraphRoot
    onSubscribed: (email: string) => void
}) => {
    return (
        <>
            <SubscribePageHero
                heading="Subscribe to our newsletters"
                subheading="Receive our latest work by email."
            />
            <div
                className={`subscribe-page__content ${SUBSCRIBE_PAGE_CONTENT_GRID_CLASSES}`}
            >
                <EmailNotificationsSubscribeForm
                    topicTagGraph={topicTagGraph}
                    onSubscribed={onSubscribed}
                />
            </div>
            <aside className="subscribe-page__aside span-cols-3 col-start-11 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2">
                <p className="subscribe-page__aside-heading h6-black-caps">
                    Already subscribed?
                </p>
                <a
                    className="subscribe-page__manage-link"
                    href="/subscribe/preferences"
                >
                    Update your preferences{" "}
                    <FontAwesomeIcon icon={faArrowRight} />
                </a>
            </aside>
            <hr className="subscribe-page__divider span-cols-12 col-start-2" />
            <div
                className={`subscribe-page__socials ${SUBSCRIBE_PAGE_CONTENT_GRID_CLASSES}`}
            >
                <OwidSocials
                    includeRss
                    context={NewsletterSubscriptionContext.SubscribePage}
                />
            </div>
        </>
    )
}
