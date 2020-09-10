import React from "react"
import { observable, action, runInAction, computed } from "mobx"
import { observer } from "mobx-react"
import { throttle } from "grapher/utils/Util"

interface CollapsibleListProps {
    items: React.ReactElement[]
}

@observer
export class CollapsibleList extends React.Component<CollapsibleListProps> {
    outerContainer: React.RefObject<HTMLDivElement> = React.createRef()
    moreButton: React.RefObject<HTMLLIElement> = React.createRef()
    outerWidth: number = 0
    moreButtonWidth: number = 0

    @observable visibleItems: React.ReactElement[] = []
    @observable dropdownItems: React.ReactElement[] = []
    widthsArray: number[] = []

    constructor(props: CollapsibleListProps) {
        super(props)
        this.visibleItems.push(...props.items)
    }

    updateOuterWidth() {
        this.outerWidth = this.outerContainer.current?.clientWidth ?? 0
    }

    numItemsVisible(outerWidth: number, initialWidth: number) {
        let total = initialWidth
        for (let i = 0; i < this.widthsArray.length; i++) {
            if (total + this.widthsArray[i] > outerWidth) {
                return i
            } else {
                total += this.widthsArray[i]
            }
        }
        return this.widthsArray.length
    }

    @action updateItemPartition() {
        const numItemsVisible = this.numItemsVisible(
            this.outerWidth, // outerListWidth,
            this.moreButtonWidth
        )
        console.log(numItemsVisible)

        this.visibleItems = this.props.items.slice(0, numItemsVisible)
        this.dropdownItems = this.props.items.slice(numItemsVisible)
    }

    onResize = throttle(() => {
        this.updateOuterWidth()
        this.updateItemPartition()
    }, 100)

    componentDidMount() {
        window.addEventListener("resize", this.onResize)
        this.updateOuterWidth()
        this.moreButtonWidth = this.moreButton.current?.clientWidth ?? 0
        this.outerContainer.current
            ?.querySelectorAll("li")
            .forEach((item) => this.widthsArray.push(item.clientWidth))
        this.updateItemPartition()

        console.log("mounted")
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.onResize)
    }

    render() {
        return (
            <div className="collapsibleList" ref={this.outerContainer}>
                <ul>
                    {this.visibleItems.map((item) => (
                        <li key={item.key} className="list-item">
                            {item}
                        </li>
                    ))}
                    {
                        <li
                            className="list-item moreButton"
                            ref={this.moreButton}
                            style={{
                                visibility: this.dropdownItems.length
                                    ? "visible"
                                    : "hidden",
                            }}
                            onClick={() =>
                                console.log(Array.from(this.dropdownItems))
                            }
                        >
                            More
                        </li>
                    }
                </ul>
            </div>
        )
    }
}

@observer
export class MoreButton extends React.Component {
    render() {
        return "hello"
    }
}

// class Useless extends React.Component {
//     constructor(props) {
//       super(props);
//       this.updateNavigation = this.updateNavigation.bind(this);
//       this.state = {
//         priorityItems: [],
//         moreItems: []
//       }
//       this.fullNavArray = this.props.navigationItems;
//     }

//     static propTypes = {
//       name: React.PropTypes.string,
//       navigationItems: React.PropTypes.array
//     };

//     static defaultProps = {
//       navigationItems: [
//         {
//           title: 'News',
//           link: '/news'
//         },
//         {
//           title: 'Gigs',
//           link: '/gigs'
//         },
//         {
//           title: 'Festivals',
//           link: '/festivals'
//         },
//         {
//           title: 'Club Nights',
//           link: '/club-nights'
//         },
//         {
//           title: 'Brands',
//           link: '/brands'
//         },
//         {
//           title: 'Genres',
//           link: '/genres'
//         },
//         {
//           title: 'Venues',
//           link: '/venues'
//         },
//         {
//           title: 'Artists',
//           link: '/artists'
//         },
//         {
//           title: 'News',
//           link: '/news'
//         },
//         {
//           title: 'Gigs',
//           link: '/gigs'
//         },
//         {
//           title: 'Festivals',
//           link: '/festivals'
//         },
//         {
//           title: 'Club Nights',
//           link: '/club-nights'
//         },
//         {
//           title: 'Brands',
//           link: '/brands'
//         },
//         {
//           title: 'Genres',
//           link: '/genres'
//         },
//         {
//           title: 'Venues',
//           link: '/venues'
//         },
//         {
//           title: 'Artists',
//           link: '/artists'
//         }
//       ]
//     };

//     componentWillMount() {
//        this.setState({
//           priorityItems: this.props.navigationItems
//         })
//     }

//     componentDidMount() {
//       //Get width of all items in navigation menu
//       this.widthsArray = Array.from(this.refs.navigation.children).map(item => item.getBoundingClientRect().width);
//       //Add resize listener but throttle for smoother experience
//       window.addEventListener('resize', _.throttle(this.updateNavigation), 100);
//       this.updateNavigation();
//     }

//     howManyItemsInMenuArray(array, outerWidth, initialWidth, minimumNumberInNav) {
//       let total = (initialWidth*1.75);
//       for(let i = 0; i < array.length; i++) {
//           if(total + array[i] > outerWidth) {
//             console.log(i);
//             return i < minimumNumberInNav ? minimumNumberInNav : i;
//           } else {
//             total += array[i];
//           }
//         }
//     }

//     updateNavigation() {
//       this.outerWidth = this.refs.navigationOuter.getBoundingClientRect().width;
//       this.moreMenu = this.refs.moreMenu ? this.refs.moreMenu.getBoundingClientRect().width : 0;
//       const arrayAmount = this.howManyItemsInMenuArray(this.widthsArray, this.outerWidth, this.moreMenu, 5);
//       const navItemsCopy = this.fullNavArray;
//       const priorityItems = navItemsCopy.slice(0, arrayAmount);

//       this.setState({
//         priorityItems: priorityItems,
//         moreItems: priorityItems.length !== navItemsCopy.length ? navItemsCopy.slice(arrayAmount, navItemsCopy.length) : []
//      });
//    }

//     componentWillUnmount() {
//       window.removeEventListener('resize', this.updateNavigation());
//     }

//     render() {
//       const { priorityItems, moreItems } = this.state;

//       return (
//         <div>
//         <nav ref="navigationOuter" className="navigation" role="navigation">
//           <ul ref="navigation" className="navigation-list">
//             {
//               priorityItems.map((item, i) => <li key={`navItem-${i}`} className="navigation-item">
//                 <a className="navigation-link" to={item.link}>{item.title}</a>
//               </li>)
//             }
//           </ul>
//           {
//             moreItems.length > 0 && <ul ref="moreMenu" className="navigation-list-absolute">
//             <li className="navigation-item more-item">
//               <a className="navigation-link" to="#">More ></a>
//               <ul ref="moreNav" className="more-navigation">
//                 {
//                   moreItems.map((item, i) => <li key={`moreNavItem-${i}`} className="navigation-item">
//                     <a className="navigation-link" to={item.link}>{item.title}</a>
//                   </li>)
//                 }
//               </ul>
//             </li>
//           </ul>
//           }
//         </nav>
//         </div>
//       );
//     }
//   }

/** ---------------------------- */
