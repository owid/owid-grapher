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
        const {tag, searchHighlight, onRemove} = this.props

        if (onRemove) {
            return <span className="TagBadge" onClick={onRemove}>{tag.name}</span>
        } else {
            return <Link className="TagBadge" to={`/categories/${tag.id}`}>{searchHighlight ? searchHighlight(tag.name) : tag.name}</Link>
        }
    }
}