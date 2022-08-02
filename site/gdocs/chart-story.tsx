import React, { useState } from 'react';
import { IoArrowBackCircleOutline, IoArrowForwardCircleOutline } from "react-icons/io5";


export default function ChartStory ({ slides, styles }: any) {

    // const [showDetails, setShowDetails] = useState(false);
    const [slide, setSlide] = useState(0);
    const showDetails = true;

    const currentSlide = slides[slide];
    const maxSlide = slides.length - 1;

    return <div className={'chartStory'}>
        <div className={'chart-story--nav-back'} onClick={() => {setSlide(Math.max(0, slide-1))}}><IoArrowBackCircleOutline color={'#577291'} size={40} /></div>
        <div className={'chart-story--narrative-text'}>{currentSlide.narrative}</div>
        <div className={'chart-story--chart'}>
            <iframe src={currentSlide.chart} loading="lazy" style={{ width: '100%', height: 550, border: '0px none' }} />
        </div>
        <div className={'chart-story--technical-text'}>
            {/* {currentSlide.technical ? (<div className={'chart-story--about-data'} onClick={() => setShowDetails(!showDetails)}>About this data</div>) : null} */}
        </div>
        <div className={'chart-story--nav-hud'}>
            Chart {slide + 1} of {slides.length}
            {/* {[...new Array(slides.length)].map((_, i) => {
                const isSelected = i === slide;
                const radius = isSelected ? 13 : 10; 
                return <div key={i} onClick={() => setSlide(i)} style={{ cursor: 'pointer', margin: '0 5px', borderRadius: '50%', width: radius, height: radius, background: isSelected ? '#fff' : '#ccc' }} />
            })} */}
        </div>
        {/* <div className={'chart-story--share'}>Share</div> */}
        <div className={'chart-story--nav-next'} onClick={() => {setSlide(Math.min(maxSlide, slide+1))}}><IoArrowForwardCircleOutline color={'#577291'} size={40} /></div>
        {
            currentSlide.technical && showDetails ?
            <div className={'chart-story--technical-details'}>
                <ul>
                    {currentSlide.technical.map((d: any, i: any) => {
                        return <li key={i}>{d}</li>
                    })}
                </ul>
            </div> : null
        }
    </div>
};
