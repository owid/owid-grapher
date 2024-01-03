import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { IMAGES_DIRECTORY, OwidGdocPostInterface } from "@ourworldindata/utils"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons"

export const DonatePage = (props: {
    baseUrl: string
    faqsGdoc: OwidGdocPostInterface
    recaptchaKey: string
}) => (
    <html>
        <Head
            canonicalUrl={`${props.baseUrl}/donate`}
            pageTitle="Donate"
            baseUrl={props.baseUrl}
            pageDesc="Support open data and research to make progress against the world's largest problems"
            imageUrl={`${props.baseUrl}${IMAGES_DIRECTORY}donate-thumbnail.png`}
        >
            <script src="https://js.stripe.com/v3/" />
            <script
                src={`https://www.google.com/recaptcha/api.js?render=${props.recaptchaKey}`}
            />
        </Head>
        <body>
            <SiteHeader baseUrl={props.baseUrl} />
            <main className="donate-page">
                <div className="donate-page-intro">
                    <div className="wrapper grid grid-cols-12">
                        <div className="donate-page-intro__content span-cols-5 span-sm-cols-12">
                            <h1 className="donate-page__title">
                                Help us do more
                            </h1>
                            <p className="article-block__text">
                                To bring about a better future, we need data and
                                research to understand the big problems the
                                world is facing and how to make progress against
                                them. That’s why we make all our work free and
                                accessible for everyone.
                            </p>
                            <p className="article-block__text">
                                We are a nonprofit. This means we rely on
                                donations and grants to keep us going. Reader
                                donations are essential to our work, providing
                                us with the stability and independence we need,
                                so we can focus on showing the data and evidence
                                we think everyone needs to know.
                            </p>
                            <p className="article-block__text">
                                Donating is also one way to show us that you
                                find our work helpful and valuable. Knowing this
                                is a huge source of inspiration for our team.
                            </p>
                            <p className="article-block__text">
                                If you want to help us do more, please donate
                                today – it will make a real difference.
                            </p>
                            <p className="article-block__text">
                                Thank you, <br />
                                <em>Global Change Data Lab</em> and the{" "}
                                <em>Our World in Data</em> team
                            </p>
                            <p className="article-block__text">
                                <a
                                    href="#fa-qs-about-donations"
                                    className="donate-page__faq-link"
                                >
                                    Learn more about donations in the FAQs
                                    <FontAwesomeIcon icon={faArrowDown} />
                                </a>
                            </p>
                        </div>
                        <div className="col-start-7 span-cols-6 col-lg-start-7 span-lg-cols-6 col-md-start-6 span-md-cols-7 span-sm-cols-12">
                            <div className="donate-form-container">
                                {/* temporary message, client-side generated form */}
                                Loading donate form&hellip;
                            </div>
                        </div>
                    </div>
                </div>
                {props.faqsGdoc.content.body ? (
                    <div className="donate-page-faqs grid grid-cols-12-full-width">
                        <ArticleBlocks blocks={props.faqsGdoc.content.body} />
                    </div>
                ) : null}
            </main>

            <SiteFooter hideDonate={true} baseUrl={props.baseUrl} />

            <script
                type="module"
                dangerouslySetInnerHTML={{
                    __html: `runDonateForm()`,
                }}
            />
        </body>
    </html>
)
