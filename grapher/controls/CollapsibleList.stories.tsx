import * as React from "react"
import { CollapsibleList } from "./CollapsibleList"

export default {
    title: "CollapsibleList",
    component: CollapsibleList,
}

export const Default = () => {
    const items = [
        <div key="element1">element1</div>,
        <div key="element2">element2</div>,
        <div key="element3">element3</div>,
        <div key="element4">element4</div>,
        <div key="element5">element5</div>,
        <div key="element6">element6</div>,
        <div key="element7">element7</div>,
        <div key="element8">element8</div>,
        <div key="element9">element9</div>,
        <div key="element10">element10</div>,
        <div key="element11">element11</div>,
        <div key="element12">element12</div>,
        <div key="element13">element13</div>,
    ]

    return <CollapsibleList items={items} />
}
