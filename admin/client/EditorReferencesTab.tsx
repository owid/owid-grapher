import * as React from 'react'
import { observer } from "mobx-react"
import { ChartEditor } from './ChartEditor'
import { computed } from 'mobx'
import { BAKED_GRAPHER_URL } from 'settings'

const BASE_URL = BAKED_GRAPHER_URL.replace(/^https?:\/\//, '')

@observer
export class EditorReferencesTab extends React.Component<{ editor: ChartEditor }> {
    @computed get references() { return this.props.editor.references || [] }
    @computed get redirects() { return this.props.editor.redirects || [] }

    render() {
        return <div>
            <section>
                <h5>References</h5>
                {this.references.length ? <React.Fragment>
                    <p>Public pages that embed or reference this chart:</p>
                    <ul className="list-group">
                        {this.references.map((post) =>
                            <li key={post.id} className="list-group-item">
                                <a href={post.url} target="_blank"><strong>{post.title}</strong></a> (<a href={`https://owid.cloud/wp/wp-admin/post.php?post=${post.id}&action=edit`} target="_blank">Edit</a>)
                            </li>
                        )}
                    </ul>
                </React.Fragment> : <p>
                    No public posts reference this chart
                </p>}
            </section>
            <section>
                <h5>Redirects</h5>
                {this.redirects.length ? <React.Fragment>
                    <ul className="list-group">
                        {this.redirects.map((redirect) =>
                            <li key={redirect.id} className="list-group-item">
                                <span className="redirect-prefix">{BASE_URL}/</span>
                                <a href={`${BAKED_GRAPHER_URL}/${redirect.slug}`} target="_blank">
                                    <strong>{redirect.slug}</strong>
                                </a>
                            </li>
                        )}
                    </ul>
                    <hr/>
                </React.Fragment> : null}
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text" id="basic-addon3">{BASE_URL}/</span>
                    </div>
                    <input type="text" className="form-control" placeholder="URL" />
                    <div className="input-group-append">
                        <button className="btn btn-primary" type="button">Add</button>
                    </div>
                </div>
            </section>
        </div>
    }
}