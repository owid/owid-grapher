import * as React from 'react'
import { observer } from "mobx-react"
import { ChartEditor } from './ChartEditor'
import { computed } from 'mobx'

@observer
export class EditorReferencesTab extends React.Component<{ editor: ChartEditor}> {
    @computed get references() { return this.props.editor.references || [] }

    render() {
        return <div>
            <section>
                <h5>References</h5>
                {this.references.length ? <React.Fragment>
                    <p>Public pages that embed or reference this chart:</p>
                    <ul className="list-group">
                        {this.references.map((post, i) =>
                            <li className="list-group-item">
                                <a href={post.url} target="_blank"><strong>{post.title}</strong></a> (<a href={`https://owid.cloud/wp/wp-admin/post.php?post=${post.id}&action=edit`} target="_blank">Edit</a>)
                            </li>
                        )}
                    </ul>
                </React.Fragment> : <p>
                    No public posts reference this chart
                </p>}
            </section>
        </div>
    }
}