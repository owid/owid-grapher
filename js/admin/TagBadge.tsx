import * as React from 'react'
import {observer} from 'mobx-react'

import Link from './Link'

export interface Tag {
    id: number
    name: string
}

@observer
export default class TagBadge extends React.Component<{ tag: Tag, onRemove?: () => void, searchHighlight?: (text: string) => any }> {
    render() {
        const {tag, searchHighlight} = this.props
        return <Link className="TagBadge" to={`/tags/${tag.id}`}>{searchHighlight ? searchHighlight(tag.name) : tag.name}</Link>
    }
}