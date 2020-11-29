import * as React from "react"
import { Modal } from "./Forms"
import { faLink } from "@fortawesome/free-solid-svg-icons/faLink"
import { faUnlink } from "@fortawesome/free-solid-svg-icons/faUnlink"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export class EditorFAQ extends React.Component<{ onClose: () => void }> {
    render() {
        return (
            <Modal onClose={this.props.onClose} className="EditorFAQ">
                <div className="modal-header">
                    <h3 className="modal-title">Frequently Asked Questions</h3>
                </div>
                <div className="modal-body">
                    <h6>How do I make a chart?</h6>
                    <p>
                        See this{" "}
                        <a
                            target="_blank"
                            rel="noopener"
                            href="https://ourworldindata.org/how-to-our-world-in-data-guide/#owid-grapher"
                        >
                            more in depth guide
                        </a>{" "}
                        for the full process.
                    </p>
                    <h6>What are "variables" and "entities"?</h6>
                    <p>
                        They roughly correspond to columns and rows in a CSV
                        file. For OWID, entities are usually but not always
                        countries.
                    </p>
                    <h6>What do the little icons mean?</h6>
                    <p>
                        If you see the <FontAwesomeIcon icon={faLink} /> link
                        icon, it means a field is currently linked to the
                        database and has its default value. By changing that
                        field you break the link{" "}
                        <FontAwesomeIcon icon={faUnlink} /> and set manual input
                        for this particular chart.
                    </p>
                    <h6>When are charts updated?</h6>
                    <p>
                        The version of the chart you see in the editor is always
                        the most current version. When published, charts are
                        bundled together in a static build process and sent to
                        Netlify for distribution around the world. This means it
                        may take a few minutes for the live version to be
                        updated.
                    </p>
                    <p>
                        The public version of a chart is not (currently) updated
                        automatically when new data is uploaded. You may need to
                        click "update chart" to have data changes reflected
                        publicly.
                    </p>
                    <p>
                        You can check the publication status and history in the{" "}
                        <a href="https://owid.slack.com/messages/changelog/">
                            #changelog
                        </a>{" "}
                        channel.
                    </p>
                    <h6>How much data can I put in one chart?</h6>
                    <p>
                        The fewer variables the better. To allow for fast
                        interactivity, the grapher preloads <strong>all</strong>{" "}
                        the data for each variable added to a chart, including
                        every year and entity. If you have 10+ big variables on
                        one chart it may be a little slow to load.
                    </p>
                    <p>
                        Similarly, if you select many entities or have very long
                        subtitles the chart will become visually cluttered. Make
                        sure there's enough room for the chart to work well in
                        the mobile preview, and if in doubt make two smaller
                        charts rather than one big one.
                    </p>
                    <h6>Why does it say "No matching data"?</h6>
                    <p>
                        Check the data selection on the "Data" tab and the
                        specified year range on the "Customize" tab.
                        Alternatively, you might be trying to show a categorical
                        variable on a numeric chart type or vice versa, which
                        won't work.
                    </p>
                    <h6>Other questions or bug reports</h6>
                    <p>
                        Fastest way to get support is to ask in{" "}
                        <a href="https://owid.slack.com/messages/tech-issues/">
                            #tech-issues
                        </a>{" "}
                        on the OWID Slack!
                    </p>
                </div>
            </Modal>
        )
    }
}
