import React = require("react")
import { BAKED_BASE_URL } from "settings"
import { FeedbackForm } from "site/client/Feedback"
import { Head } from "./Head"
import { SiteFooter } from "./SiteFooter"
import { SiteHeader } from "./SiteHeader"

export class FeedbackPage extends React.Component {
    render() {
        return (
            <html>
                <Head
                    canonicalUrl={`${BAKED_BASE_URL}/feedback`}
                    pageTitle="Feedback"
                    pageDesc="Do you have feedback or suggestions for improving Our World in Data? Let us know!"
                />
                <body className="FeedbackPage">
                    <SiteHeader />
                    <main>
                        <FeedbackForm />
                    </main>
                    <SiteFooter hideDonate={true} />
                </body>
                <script>{`window.runFeedbackPage()`}</script>
            </html>
        )
    }
}
