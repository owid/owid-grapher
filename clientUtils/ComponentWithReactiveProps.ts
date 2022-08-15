import { autorun, IReactionDisposer, observable } from "mobx"

import React from "react"
/** This is a helper class for React components that don't use the Manager pattern
    we often use but just want to use normal props in an efficient way.

    The problem with MobX and React props is that creating props at the usage site
    creates a new prop object and thus all properties in a class using computed
    properties to derive values from props will be regenerated.

    This class solves this by adding a new observable called reactiveProps that
    should be used instead of this.props when computing derived values in a React
    component. The reactiveProps are updated from props automatically but because
    this is copied to a separate observable object the usual mobx magic works again
    and only properties that change trigger updates in derived classes.

    When using the manager pattern this is not necessary because we usually pass
    a reference to the parent object anyhow that does not change. It is also unnecessary
    if all props are themselves observable objects (since then mobx tracking works again).
*/
export class ComponentWithReactiveProps<T> extends React.Component<T> {
    constructor(props: T) {
        super(props)
        const reactiveProps = {}
        Object.assign(reactiveProps, this.props)
        this.reactiveProps = reactiveProps as T
        this.reactivePropsCleanup = autorun(() =>
            Object.assign(this.reactiveProps, this.props)
        )
    }

    override componentWillUnmount(): void {
        if (super.componentWillUnmount) super.componentWillUnmount()
        this.reactivePropsCleanup()
    }

    reactivePropsCleanup: IReactionDisposer

    /** A copy of the React props that tracks updates more effeciently to minimize
    unnecessary recomputations. Use this instead of props. */
    @observable.struct reactiveProps: T
}
