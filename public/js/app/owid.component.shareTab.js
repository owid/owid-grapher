;(function(d3) {    
    "use strict";
    owid.namespace("owid.view.shareMenu");

    owid.view.embedMenu = function() {
        var embedMenu = owid.dataflow();

        embedMenu.needs('containerNode', 'baseUrl', 'queryStr');

        embedMenu.flow('el : containerNode', function(containerNode) {
            var el = d3.select(containerNode).append('div').attr('class', 'embedMenu');

            el.on('click', function() {
                d3.event.stopPropagation();
            });

            // Dismiss when user clicks away from menu
            setTimeout(function() {
                embedMenu.listenTo(d3.select(window), 'click.embedMenu', function() {
                    embedMenu.clean();
                });
            }, 50);

            el.html('<h2>Embed</h2>');

            return el;
        });        

        embedMenu.beforeClean(function() {
            if (embedMenu.el) embedMenu.el.remove();
        });

        embedMenu.flow('textarea : el', function(el) {
            el.append('p').html('Paste this into any HTML page:');
            var textarea = el.append('textarea');

            textarea.on('focus', function() {
                textarea.node().select();
            });

            return textarea;
        });

        embedMenu.flow('embedCode : baseUrl, queryStr', function(baseUrl, queryStr) {
            return '<iframe src="' + (baseUrl+queryStr) + '" style="width: 100%; height: 600px; border: 0px none;"></iframe>';
        });

        embedMenu.flow('textarea, embedCode', function(textarea, embedCode) {
            textarea.text(embedCode);
        });

        return embedMenu;
    };

    owid.view.shareMenu = function() {
        var shareMenu = owid.dataflow();

        shareMenu.needs('containerNode', 'title', 'baseUrl', 'queryStr', 'cacheTag', 'editUrl');

        shareMenu.flow('el : containerNode', function(containerNode) {
            var el = d3.select(containerNode).append('div').attr('class', 'shareMenu');

            el.on('click', function() {
                d3.event.stopPropagation();
            });

            // Dismiss when user clicks away from menu
            setTimeout(function() {
                shareMenu.listenTo(d3.select(window), 'click.shareMenu', function() {
                    shareMenu.clean();
                });
            }, 50);

            el.append('h2').html('Share');

            return el;
        });        

        // Share section

        shareMenu.flow('linkBtn, twitterBtn, facebookBtn, embedBtn, pngBtn, svgBtn : el', function(el) {
            return [
                el.append('a').attr('class', 'btn btn-facebook').attr('target', '_blank')
                  .attr('title', "Link to visualization").html('<i class="fa fa-link"></i> Link'),

                el.append('a').attr('class', 'btn btn-twitter').attr('target', '_blank')
                  .attr('title', "Tweet a link").html('<i class="fa fa-twitter"></i> Twitter'),

                el.append('a').attr('class', 'btn btn-facebook').attr('target', '_blank')
                  .attr('title', "Share on Facebook").html('<i class="fa fa-facebook"></i> Facebook'),

                el.append('a').attr('class', 'btn btn-embed')
                  .attr('title', "Embed this visualization in another HTML document").html('<i class="fa fa-code"></i> Embed'),

                el.append('a').attr('class', 'btn btn-png').attr('target', '_blank')
                  .attr('title', "Save visualization in raster format").html('<i class="fa fa-download"></i> Save as PNG'),

                el.append('a').attr('class', 'btn btn-svg').attr('target', '_blank')
                  .attr('title', "Save visualization in vector graphics format").html('<i class="fa fa-download"></i> Save as SVG'),
            ];
        });

        shareMenu.flow('editBtn : el, editUrl', function(el, editUrl) {
            if (editUrl)
                el.append('a').attr('class', 'btn btn-edit').attr('target', '_blank')
                    .attr('href', editUrl).attr('title', 'Edit chart').html('<i class="fa fa-edit"></i> Edit');
            else
                el.selectAll('.btn-edit').remove();
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

        shareMenu.flow('embedBtn, containerNode, baseUrl, queryStr', function(embedBtn, containerNode, baseUrl, queryStr) {
            embedBtn.on('click', function() {                
                shareMenu.toggleChild('embedMenu', owid.view.embedMenu, function(embedMenu) {
                    embedMenu.update({
                        containerNode: containerNode,
                        baseUrl: baseUrl,
                        queryStr: queryStr
                    });
                });
            });
        });

        shareMenu.beforeClean(function() {
            if (shareMenu.el) shareMenu.el.remove();
        });

        return shareMenu;
    };
})(d3v4);