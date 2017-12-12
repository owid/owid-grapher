import * as React from 'react'
import { Modal } from './Forms'

export class EditorFAQ extends React.Component<{ onClose: () => void }> {
    render() {
        return <Modal onClose={this.props.onClose} className="EditorFAQ">
            <div className="modal-header">
                <h3 className="modal-title">Frequently Asked Questions</h3>
            </div>
            <div className="modal-body">
                <h6>How do I make a chart?</h6>
                <p>See this <a target="_blank" href="https://ourworldindata.org/how-to-our-world-in-data-guide/#owid-grapher">more in depth guide</a> for the full process.</p>
                <h6>What are "variables" and "entities"?</h6>
                <p>They roughly correspond to columns and rows in a CSV file. For OWID, entities are usually but not always countries.</p>
                <h6>What do the little icons mean?</h6>
                <p>If you see the <i className="fa fa-link"/> link icon, it means a field is currently linked to the database and has its default value. By changing that field you break the link <i className="fa fa-unlink"/> and set manual input for this particular chart.</p>
                <h6>When are charts updated?</h6>
                <p>The version of the chart you see in the editor is the "canonical" version that reflects the current data. Once published, all charts are cached at servers around the world for distribution. When you click "Update chart" a request is sent to these servers to update their version, which may take a few moments.</p>
                <h6>How much data can I put in one chart?</h6>
                <p>The fewer variables the better. To allow for fast interactivity, the grapher preloads <strong>all</strong> the data for each variable added to a chart, including every year and entity. If you have 10+ big variables on one chart it may be a little slow to load.</p>
                <p>Similarly, if you select many entities or have very long subtitles the chart will become visually cluttered. Make sure there's enough room for the chart to work well in the mobile preview, and if in doubt make two smaller charts rather than one big one.</p>
                <h6>Why does it say "No matching data"?</h6>
                <p>Check the data selection on the "Data" tab and the specified year range on the "Customize" tab. Alternatively, you might be trying to show a categorical variable on a numeric chart type or vice versa, which won't work.</p>
                <h6>Other questions or bug reports</h6>
                <p>Fastest way to get support is to ask in <a href="https://owid.slack.com/messages/tiny-tech-problems/">#tiny-tech-problems</a> on the OWID Slack!</p>
            </div>
        </Modal>
    }
}