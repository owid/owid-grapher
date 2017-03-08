import * as d3 from 'd3'

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

        return el;
    });        

    embedMenu.beforeClean(function() {
        if (embedMenu.el) embedMenu.el.remove();
    });

    embedMenu.flow('textarea : el', function(el) {
        });

        return textarea;
    });

    embedMenu.flow('embedCode : baseUrl, queryStr', function(baseUrl, queryStr) {
        return 
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
            el.append('a').attr('class', 'btn btnLink').attr('target', '_blank')
              .attr('title', "Link to visualization").html('<i class="fa fa-link"></i> Link'),

            el.append('a').attr('class', 'btn btnTwitter').attr('target', '_blank')
              .attr('title', "Tweet a link").html('<i class="fa fa-twitter"></i> Twitter'),

            el.append('a').attr('class', 'btn btnFacebook').attr('target', '_blank')
              .attr('title', "Share on Facebook").html('<i class="fa fa-facebook"></i> Facebook'),

            el.append('a').attr('class', 'btn btnEmbed')
              .attr('title', "Embed this visualization in another HTML document").html('<i class="fa fa-code"></i> Embed'),

            el.append('a').attr('class', 'btn btnPng').attr('target', '_blank')
              .attr('title', "Save visualization in raster format").html('<i class="fa fa-download"></i> Save as PNG'),

            el.append('a').attr('class', 'btn btnSvg').attr('target', '_blank')
              .attr('title', "Save visualization in vector graphics format").html('<i class="fa fa-download"></i> Save as SVG'),
        ];
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
