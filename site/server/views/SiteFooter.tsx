import * as React from 'react'
import { webpack } from 'utils/server/staticGen'

export const SiteFooter = () => {
    return <footer className="site-footer">
        <div className="wrapper">
            <div className="owid-row">
                <div className="owid-col owid-col--lg-1">
                    <ul>
                        <li><a href="/about">About</a></li>
                        <li><a href="/about#contact">Contact</a></li>
                        <li><a href="/jobs">Jobs</a></li>
                        <li><a href="/about#supporters">Supporters</a></li>
                        <li><a href="/about/how-to-use-our-world-in-data">How to use</a></li>
                        <li><a href="/donate">Donate</a></li>
                    </ul>
                </div>
                <div className="owid-col owid-col--lg-1">
                    <ul>
                        <li><a href="/blog">Blog</a></li>
                        <li><a href="/charts">All charts</a></li>
                    </ul>
                    <ul>
                        <li><a href="https://twitter.com/OurWorldInData">Twitter</a></li>
                        <li><a href="https://www.facebook.com/OurWorldinData">Facebook</a></li>
                        <li><a href="https://github.com/owid">GitHub</a></li>
                        <li><a href="/feed">RSS Feed</a></li>
                    </ul>
                </div>
                <div className="owid-col owid-col--lg-1">
                    <div className="logos">
                        <a href="https://www.oxfordmartin.ox.ac.uk/research/programmes/global-development" className="partner-logo">
                            <img src="/oxford-logo-rect.png" alt="University of Oxford logo"/>
                        </a>
                        <a href="https://global-change-data-lab.org/" className="partner-logo">
                            <img src="/gcdl-logo.png" alt="Global Change Data Lab logo"/>
                        </a>
                        <a href="/owid-at-ycombinator" className="partner-logo">
                            <img src="/yc-logo.png" alt="Y Combinator logo"/>
                        </a>
                    </div>
                </div>
                <div className="owid-col flex-2">
                    <div className="legal">
                        <p>
                            License: All of Our World in Data is completely open access and all work is licensed under the <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons BY license</a>. You have the permission to use, distribute, and reproduce in any medium, provided the source and authors are credited.
                        </p>
                        <p>
                            Please consult our full <a href="/about#legal">legal disclaimer</a>.
                        </p>
                        {/* <a href="/" className="owid-logo">Our World in Data</a> */}
                    </div>
                </div>
            </div>
        </div>
        <div className="feedbackPromptContainer"></div>
        <script src={webpack('commons.js', 'site')}/>
        <script src={webpack('owid.js', 'site')}/>
        <script dangerouslySetInnerHTML={{__html: `
            runHeaderMenus();
            runFeedback();
            Grapher.embedAll();
        `}}/>
    </footer>
}