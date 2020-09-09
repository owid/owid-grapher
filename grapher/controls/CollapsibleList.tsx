import React from "react"
import { observable } from "mobx"
import { observer } from "mobx-react"

interface CollapsibleListProps {
    items: React.ReactElement[]
}

@observer
export class CollapsibleList extends React.Component<CollapsibleListProps> {
    @observable visibleItems: React.ReactElement[] = []
    @observable dropdownItems: React.ReactElement[] = [
        <div key="Extra">Extra</div>,
    ]

    componentDidMount() {
        this.visibleItems.push(...this.props.items)
    }

    render() {
        return (
            <div className="collapsibleList">
                <ul>
                    {this.visibleItems.map((item) => (
                        <li key={item.key} className="list-item">
                            {item}
                        </li>
                    ))}
                </ul>
                {this.dropdownItems.length > 0 && <div>More</div>}
            </div>
        )
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

// interface ListItem {
//     name: string
//         item: React.ReactElement
// }

// export class CollapsingList extends React.Component<{
//     items: {
//         name: string
//         item: React.ReactElement
//     }[]
// }> {
//     render() {
//         return (
//             <div className="controlsRow">
//                 <ul>
//                     {this.props.items.map((item) => (
//                         <li key={item.type} className="control">
//                             {control}
//                         </li>
//                     ))}
//                 </ul>
//             </div>
//         )
//     }
// }
