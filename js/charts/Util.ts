import Bounds from './Bounds'

export type SVGElement = any;
export type VNode = any;
export const NullElement : any = (): null => null;

export function getRelativeMouse(node: SVGElement, event: MouseEvent): [number, number] {
  const clientX = event.clientX || event.targetTouches[0].clientX
  const clientY = event.clientY || event.targetTouches[0].clientY

  var svg = node.ownerSVGElement || node;

  if (svg.createSVGPoint) {
    var point = svg.createSVGPoint();
    point.x = clientX, point.y = clientY;
    point = point.matrixTransform(node.getScreenCTM().inverse());
    return [point.x, point.y];
  }

  var rect = node.getBoundingClientRect();
  return [clientX - rect.left - node.clientLeft, clientY - rect.top - node.clientTop];
};

// Create an instance of a JSX node before rendering
// Used for when we need to precalculate bounds
export function preInstantiate(vnode: VNode) {
    return new vnode.nodeName(vnode.props)
}


// Make an arbitrary string workable as a css class name
export function makeSafeForCSS(name: string) {
    return name.replace(/[^a-z0-9]/g, function(s) {
        var c = s.charCodeAt(0);
        if (c == 32) return '-';
        if (c == 95) return '_';
        if (c >= 65 && c <= 90) return s;
        return '__' + ('000' + c.toString(16)).slice(-4);
    });
};

// Transform entity name to match counterpart in world.ids.json
// Covers e.g. Cote d'Ivoire -> Cote_d_Ivoire
// Also removes non-ascii characters which may break datamaps
export function entityNameForMap(name: string) {
    return makeSafeForCSS(name.replace(/[ '&:\(\)\/]/g, "_"));
};

export function formatYear(year: number): string {
    if (isNaN(year)) {
        console.error("Invalid year '" + year + "'");
        return null;
    }

    if (year < 0)
        return Math.abs(year) + " BCE";
    else
        return year.toString();
}
