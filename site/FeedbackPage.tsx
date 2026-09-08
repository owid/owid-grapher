import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import {
    FeedbackForm,
    FEEDBACK_FORM_CONTAINER_CLASS,
    FEEDBACK_FORM_TITLE,
} from "./Feedback.js"
import { Html } from "./Html.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"

export const FeedbackPage = ({ baseUrl }: { baseUrl: string }) => (
    <Html>
        <Head
            canonicalUrl={`${baseUrl}/feedback`}
            pageTitle="Feedback"
            pageDesc="Do you have feedback or suggestions for improving Our World in Data? Let us know!"
            baseUrl={baseUrl}
        />
        <body>
            <SiteHeader />
            <main className="feedback-page">
                <div className="feedback-page-intro">
                    <div className="wrapper grid grid-cols-12">
                        <div className="feedback-page-intro__content span-cols-5 span-sm-cols-12">
                            <h1 className="feedback-page__title">
                                {FEEDBACK_FORM_TITLE}
                            </h1>
                            <p className="article-block__text">
                                Have you spotted a mistake, found something
                                confusing, or do you have an idea for how we
                                could improve? We would love to hear from you.
                                Your feedback helps us make Our World in Data
                                better for everyone.
                            </p>
                            <p className="article-block__text">
                                We read all the feedback we receive. Due to the
                                high volume of messages, we are not always able
                                to reply, but every message helps us understand
                                what we can do better.
                            </p>
                            <p className="article-block__text">
                                Have a question? Many common questions – about
                                reusing our charts and data, citing our work, or
                                how we are funded – are answered in our FAQs.
                            </p>
                            <p className="article-block__text">
                                <a
                                    href={`${baseUrl}/faqs`}
                                    className="feedback-page__faq-link"
                                >
                                    Read our FAQs
                                    <FontAwesomeIcon icon={faArrowRight} />
                                </a>
                            </p>
                        </div>
                        <div className="col-start-7 span-cols-6 col-lg-start-7 span-lg-cols-6 col-md-start-6 span-md-cols-7 span-sm-cols-12">
                            <div className={FEEDBACK_FORM_CONTAINER_CLASS}>
                                {/* Server-rendered for a fast first paint; replaced by the interactive form client-side */}
                                <FeedbackForm />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <SiteFooter hideDonate />
            <script type="module">{`window.runFeedbackPage()`}</script>
        </body>
    </Html>
)
