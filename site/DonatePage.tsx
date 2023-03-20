import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"

export const DonatePage = (props: {
    baseUrl: string
    recaptchaKey: string
}) => (
    <html>
        <Head
            canonicalUrl={`${props.baseUrl}/donate`}
            pageTitle="Donate"
            baseUrl={props.baseUrl}
        >
            <script src="https://js.stripe.com/v3/" />
            <script
                src={`https://www.google.com/recaptcha/api.js?render=${props.recaptchaKey}`}
            />
        </Head>
        <body>
            <SiteHeader baseUrl={props.baseUrl} />
            <main>
                <article className="donate-page">
                    <div className="page-header">
                        <div className="wrapper">
                            <h1 className="page-heading">Help us do more</h1>
                        </div>
                    </div>
                    <div className="wrapper">
                        <div className="columns">
                            <div className="column">
                                <p>
                                    To bring about a better future, we need data
                                    and research to understand the big problems
                                    the world is facing and how to make progress
                                    against them. That’s why we make all our
                                    work free and accessible for everyone.
                                </p>
                                <p>
                                    We are a nonprofit. This means we rely on
                                    donations and grants to keep us going.
                                    Reader donations are essential to our work,
                                    providing us with the stability and
                                    independence we need, so we can focus on
                                    showing the data and evidence we think
                                    everyone needs to know.
                                </p>
                                <p>
                                    Donating is also one way to show us that you
                                    find our work helpful and valuable. Knowing
                                    this is a huge source of inspiration for our
                                    team.
                                </p>
                                <p>
                                    If you want to help us do more, please
                                    donate today – it will make a real
                                    difference.
                                </p>
                                <p>
                                    Thank you, <br />
                                    Global Change Data Lab and the Our World in
                                    Data team
                                </p>
                                <hr />
                                <p>
                                    <a href="/about">About us</a> &ndash;{" "}
                                    <a href="https://ourworldindata.org/uploads/2019/02/Donations-Policy-Global-Change-Data-Lab.pdf">
                                        Donations Policy
                                    </a>{" "}
                                    &ndash;{" "}
                                    <a href="/donate/faq">Donations FAQ</a>
                                </p>
                            </div>
                            <div className="column">
                                <div className="donate-form-container shaded-box">
                                    {/* temporary message, client-side generated form */}
                                    Loading donate form&hellip;
                                </div>
                            </div>
                        </div>
                        <div className="columns">
                            <div className="column"></div>
                        </div>
                    </div>
                </article>
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
