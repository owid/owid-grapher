declare module "d3-geo-projection" {
    // These are the only two exports we need
    function geoPatterson(): import("d3-geo").GeoProjection
    function geoRobinson(): import("d3-geo").GeoProjection
}
