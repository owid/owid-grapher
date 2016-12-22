;(function(d3) {    
    "use strict";
    owid.namespace("owid.component.shareTab");

    owid.view.shareMenu = function() {
        var shareMenu = owid.dataflow();

        shareMenu.requires('containerNode', 'bounds', 'title', 'sharingUrl');

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

        shareMenu.flow('shareSection : el', function(el) {
            var shareSection = el.append('section').attr('class', 'share');
            shareSection.append('h2').html('Share');
            return shareSection;
        });

        shareMenu.flow('twitterBtn, facebookBtn, linkBtn : shareSection', function(shareSection) {
            return [
                shareSection.append('a').attr('class', 'btn btn-twitter').attr('target', '_blank')
                  .attr('title', "Tweet a link").html('<i class="fa fa-twitter"></i> Twitter'),

                shareSection.append('a').attr('class', 'btn btn-facebook').attr('target', '_blank')
                  .attr('title', "Share on Facebook").html('<i class="fa fa-facebook"></i> Facebook'),

                shareSection.append('a').attr('class', 'btn btn-facebook').attr('target', '_blank')
                  .attr('title', "Link to visualization").html('<i class="fa fa-link"></i> Link')
            ];
        });

        shareMenu.flow('twitterBtn, title, sharingUrl', function(twitterBtn, title, sharingUrl) {
            twitterBtn.attr('href', "https://twitter.com/intent/tweet/?text=" + encodeURIComponent(title) + "&url=" + encodeURIComponent(sharingUrl));
        });

        shareMenu.flow('facebookBtn, title, sharingUrl', function(facebookBtn, title, sharingUrl) {
            facebookBtn.attr('href', "https://www.facebook.com/dialog/share?app_id=1149943818390250&display=page&href=" + encodeURIComponent(sharingUrl));            
        });

        shareMenu.flow('linkBtn, sharingUrl', function(linkBtn, sharingUrl) {
            linkBtn.attr('href', sharingUrl);
        });

        shareMenu.flow('embedSection : el', function(el) {
            var embedSection = el.append('section');
            embedSection.append('h2').html('Embed');
            return embedSection;
        });

        shareMenu.flow('embedSection', function(embedSection) {

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
            var baseUrl = Global.rootUrl + '/' + chart.model.get('chart-slug'),
                sharingUrl = baseUrl + (chart.url.lastQueryStr||"");

            shareTab.update({
                containerNode: chart.htmlNode,
                bounds: owid.bounds(bounds.left*chart.scale, bounds.top*chart.scale, bounds.width*chart.scale, bounds.height*chart.scale),
                title: document.title.replace(" - Our World In Data", ""),
                sharingUrl: sharingUrl
            });            
        };

        return shareTab;
    };
})(d3v4);