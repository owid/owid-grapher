import React = require("react");
import { Head } from "./Head";
import { BAKED_BASE_URL } from "settings";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { FeedbackForm } from "site/client/Feedback";

export class FeedbackPage extends React.Component {
    render() {
        return <html>
            <Head canonicalUrl={`${BAKED_BASE_URL}/feedback`} pageTitle="Feedback"/>
            <body className="FeedbackPage">
                <SiteHeader/>
                <main>
                    <FeedbackForm onDismiss={() => undefined}/>
                </main>
                <SiteFooter/>
            </body>
            <script>{`window.runFeedbackPage()`}</script>
        </html>
    }
}
