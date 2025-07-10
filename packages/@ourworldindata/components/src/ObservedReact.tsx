import React from "react"

export abstract class ObservedReactComponent<
    P = Record<string, unknown>,
    S = Record<string, unknown>,
> extends React.Component<P, S> {
    /**
     * We need to add this special `observedProps` property (which is just a copy of `this.props`)
     * to the component so that we can properly observe changes in the props using mobx-react.
     *
     * See https://github.com/mobxjs/mobx/blob/main/packages/mobx-react/README.md#note-on-using-props-and-state-in-derivations.
     *
     * In my testing, I haven't noticed any issues with this approach, including how it is deemed to be incompatible with React's strict mode.
     * - @marcelgerber, 2025-07-10
     */
    protected observedProps: P = this.props
}
