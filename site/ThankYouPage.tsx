import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { IMAGES_DIRECTORY } from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faFacebook, faXTwitter } from "@fortawesome/free-brands-svg-icons"

const shareMessage =
    "I’m proud to be a supporter of Our World in Data! Their team builds a public resource, free for everyone, that makes the research and data on the world’s largest problems easier to access and understand. You can donate here:"
const donateLink = "https://ourworldindata.org/donate"

export const ThankYouPage = (props: { baseUrl: string }) => (
    <html>
        <Head
            canonicalUrl={`${props.baseUrl}/thank-you`}
            pageTitle="Thank you"
            baseUrl={props.baseUrl}
            pageDesc="Thank you for supporting Our World in Data"
            imageUrl={`${props.baseUrl}${IMAGES_DIRECTORY}donate-thumbnail.png`}
        ></Head>
        <body>
            <SiteHeader baseUrl={props.baseUrl} />
            <main className="thank-you-page">
                <div className="wrapper grid grid-cols-12">
                    <div className="thank-you-page__content span-cols-5 span-sm-cols-12">
                        <h1 className="thank-you-page__title">Thank you!</h1>
                        <p className="article-block__text">
                            Thank you for your support. We really appreciate it.
                            Your name should appear on{" "}
                            <a href="/funding">our public list of donors</a>{" "}
                            next time we update it.
                        </p>
                        <p className="article-block__text">
                            We have sent a receipt to the e-mail you provided.
                            If you have any questions, please visit our
                            Donations FAQ or otherwise get in touch with us at{" "}
                            <a href="mailto:donate@ourworldindata.org">
                                donate@ourworldindata.org
                            </a>
                            .
                        </p>
                        <hr className="article-block__horizontal-rule" />
                        <h2 className="share-campaign__heading">
                            Share this campaign to help us even more
                        </h2>
                        <p className="article-block__text">
                            You can help us even more by sharing our donation
                            page and letting others know we are fundraising.
                        </p>
                        <h5 className="share-message__heading">
                            Share a message with your followers
                        </h5>
                        <div className="share-message__content">
                            “{shareMessage} <a href="/donate">{donateLink}</a>”
                            <div className="share-message__buttons">
                                <a
                                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                                        shareMessage
                                    )}&url=${encodeURIComponent(
                                        donateLink
                                    )}&via=OurWorldInData`}
                                    className="share-message__button"
                                    target="_blank"
                                    rel="noopener"
                                >
                                    <FontAwesomeIcon icon={faXTwitter} />
                                </a>
                                <a
                                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                                        donateLink
                                    )}`}
                                    className="share-message__button"
                                    target="_blank"
                                    rel="noopener"
                                >
                                    <FontAwesomeIcon icon={faFacebook} />
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className="col-start-7 span-cols-6 span-md-start-6 span-md-cols-7 span-sm-cols-12">
                        <video
                            className="thank-you-page__video"
                            controls
                            width="480"
                            height="270"
                        >
                            <source
                                src="https://assets.ourworldindata.org/uploads/2019/02/thank-you.mp4"
                                type="video/mp4"
                            />
                            Your browser does not support the video tag.
                        </video>
                    </div>
                </div>
            </main>

            <SiteFooter hideDonate={true} baseUrl={props.baseUrl} />
        </body>
    </html>
)
