import {extend, map} from 'lodash'
import * as d3 from 'd3'
import * as React from 'react'
import {computed} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'

@observer
export default class SourcesTab extends React.Component<{ bounds: Bounds, sources: { description: string }[] }, undefined> {
	@computed get bounds() : Bounds {
		return this.props.bounds
	}

	@computed.struct get sources() : Object[] {
		return this.props.sources
	}

	render() {
		const { bounds, sources } = this

		return <div className="sourcesTab" style={extend(bounds.toCSS(), { position: 'absolute' })}>
			<div>
				<h2>Sources</h2>
				<div dangerouslySetInnerHTML={{__html: map(sources, 'description').join(' ') }} />
			</div>
		</div>
	}
}
