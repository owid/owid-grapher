;(function(d3) {    
    "use strict";
    owid.namespace("owid.component.shareTab");

    owid.view.shareMenu = function() {
        var shareMenu = owid.dataflow();

        shareMenu.requires('containerNode', 'bounds', 'title', 'baseUrl', 'queryStr', 'cacheTag');

        shareMenu.flow('el : containerNode', function(containerNode) {
            return d3.select(containerNode).append('div').attr('class', 'shareMenu');
        });        

        shareMenu.flow('el, bounds', function(el, bounds) {
            el.style('position', 'absolute')
              .style('left', bounds.left+'px')
              .style('top', bounds.top+'px')
              .style('width', bounds.width+'px')
              .style('height', bounds.height+'px');
        });

        // Share section

        shareMenu.flow('shareSection : el', function(el) {
            var shareSection = el.append('section').attr('class', 'share');
            shareSection.append('h2').html('Share');
            return shareSection;
        });

        shareMenu.flow('twitterBtn, facebookBtn, linkBtn, pngBtn, svgBtn : shareSection', function(shareSection) {
            return [
                shareSection.append('a').attr('class', 'btn btn-twitter').attr('target', '_blank')
                  .attr('title', "Tweet a link").html('<i class="fa fa-twitter"></i> Twitter'),

                shareSection.append('a').attr('class', 'btn btn-facebook').attr('target', '_blank')
                  .attr('title', "Share on Facebook").html('<i class="fa fa-facebook"></i> Facebook'),

                shareSection.append('a').attr('class', 'btn btn-facebook').attr('target', '_blank')
                  .attr('title', "Link to visualization").html('<i class="fa fa-link"></i> Link'),

                shareSection.append('a').attr('class', 'btn btn-png').attr('target', '_blank')
                  .attr('title', "Save visualization in raster format").html('<i class="fa fa-download"></i> Save as PNG'),

                shareSection.append('a').attr('class', 'btn btn-svg').attr('target', '_blank')
                  .attr('title', "Save visualization in vector graphics format").html('<i class="fa fa-download"></i> Save as SVG')
            ];
        });

        shareMenu.flow('twitterBtn, title, baseUrl, queryStr', function(twitterBtn, title, baseUrl, queryStr) {
            twitterBtn.attr('href', "https://twitter.com/intent/tweet/?text=" + encodeURIComponent(title) + "&url=" + encodeURIComponent(baseUrl+queryStr));
        });

        shareMenu.flow('facebookBtn, title, baseUrl, queryStr', function(facebookBtn, title, baseUrl, queryStr) {
            facebookBtn.attr('href', "https://www.facebook.com/dialog/share?app_id=1149943818390250&display=page&href=" + encodeURIComponent(baseUrl+queryStr));            
        });

        shareMenu.flow('linkBtn, baseUrl, queryStr', function(linkBtn, baseUrl, queryStr) {
            linkBtn.attr('href', baseUrl+queryStr);
        });

        shareMenu.flow('pngBtn, baseUrl, queryStr, cacheTag', function(pngBtn, baseUrl, queryStr, cacheTag) {
            var pngHref = baseUrl + '.png' + queryStr, defaultTargetSize = "1200x800";
            pngBtn.attr('href', pngHref + (_.include(pngHref, "?") ? "&" : "?") + "size=" + defaultTargetSize + "&v=" + cacheTag);
        });

        shareMenu.flow('svgBtn, baseUrl, queryStr, cacheTag', function(svgBtn, baseUrl, queryStr, cacheTag) {
            var svgHref = baseUrl + '.svg' + queryStr, defaultTargetSize = "1200x800";
            svgBtn.attr('href', svgHref + (_.include(svgHref, "?") ? "&" : "?") + "size=" + defaultTargetSize + "&v=" + cacheTag);
        });

        // Embed section

        shareMenu.flow('embedSection : el', function(el) {
            var embedSection = el.append('section');
            embedSection.append('h2').html('Embed');
            return embedSection;
        });

        shareMenu.flow('embedTextarea : embedSection', function(embedSection) {
            embedSection.append('p').html('Paste this into any HTML page:');
            return embedSection.append('textarea');
        });

        shareMenu.flow('embedCode : baseUrl, queryStr', function(baseUrl, queryStr) {
            return '<iframe src="' + (baseUrl+queryStr) + '" style="width: 100%; height: 600px; border: 0px none;"></iframe>';
        });

        shareMenu.flow('embedTextarea, embedCode', function(embedTextarea, embedCode) {
            embedTextarea.text(embedCode);
        });

        // Make it highlight text on focus
        shareMenu.flow('embedTextarea', function(embedTextarea) {
            embedTextarea.on('focus', function() {
                embedTextarea.node().select();
            });
        });

        shareMenu.beforeClean(function() {
            if (shareMenu.el) shareMenu.el.remove();
        });

        return shareMenu;
    };

    owid.component.shareTab = function(chart) {
        var shareTab = owid.view.shareMenu();

        shareTab.isOverlay = true;


        shareTab.render = function(bounds) {
            shareTab.update({
                containerNode: chart.htmlNode,
                bounds: owid.bounds(bounds.left*chart.scale, bounds.top*chart.scale, bounds.width*chart.scale, bounds.height*chart.scale),
                title: document.title.replace(" - Our World In Data", ""),
                baseUrl: Global.rootUrl + '/' + chart.model.get('chart-slug'),                
                queryStr: chart.url.lastQueryStr||"",
                cacheTag: chart.model.get("variableCacheTag")                
            });            
        };

        return shareTab;
    };
})(d3v4);