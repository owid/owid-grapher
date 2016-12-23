;(function(d3) {
    "use strict";
    owid.namespace("owid.view.scatter");

    owid.view.entitySelect = function() {
        var entitySelect = owid.dataflow();

        entitySelect.needs('containerNode', 'entities');

        entitySelect.defaults({ searchString: "" });

        entitySelect.flow('el : containerNode', function(containerNode) {
            return d3.select(containerNode).append('div').attr('class', 'entitySelect');
        });

        entitySelect.flow('el', function(el) {
            el.on('keydown', function() {
                if (d3.event.code == 'Escape')
                    entitySelect.clean();
            });
            
            /*var h2 = el.append('h2').text("Select entity");
            var closeBtn = h2.append('button').attr('class', 'btnClose clickable').html('<i class="fa fa-close"></i>');

            closeBtn.on('click', function() {
                entitySelect.clean();
            });*/

            return el;
        });

        entitySelect.flow('searchInput : el', function(el) {
            var searchInput = el.append('input').attr('type', 'search').attr('placeholder', 'Search...');

            searchInput.on('input', function() {
                entitySelect.update({ searchString: searchInput.property('value') });
            });

            searchInput.on('keydown', function() {
                if (d3.event.code == 'Enter') {
                    entitySelect.now('searchResults', function(searchResults) {
                        if (!_.isEmpty(searchResults))
                            entitySelect.select(searchResults[0]);
                    });
                }
            });

            searchInput.node().focus();

            d3.select(window).on('click.entitySelect', function() {
                entitySelect.clean();
            });

            el.on('click', function() {
                d3.event.stopPropagation();
            });

            return searchInput;
        });

        entitySelect.flow('searchString, searchInput', function(searchString, searchInput) {
            searchInput.property('value', searchString);
        });

        entitySelect.flow('ul : el', function(el) {
            return el.append('ul');
        });

        entitySelect.flow('entitySearch : entities', function(entities) {
            return new Fuse(entities, {
                shouldSort: true,
                threshold: 0.6,
                location: 0,
                distance: 100,
                maxPatternLength: 32,
                minMatchCharLength: 1,
                keys: [
                  "name"
                ]
            });
        });

        entitySelect.flow('searchResults : entitySearch, entities, searchString', function(entitySearch, entities, searchString) {
            return _.isEmpty(searchString) ? entities : entitySearch.search(searchString);
        });

        entitySelect.flow('ul, searchResults', function(ul, searchResults) {
            var update = ul.selectAll('li').data(searchResults);
            update.exit().remove();
            var lis = update.enter().append('li').attr('class', 'clickable').merge(update);
            lis.html(function(d) { return d.name; });

            lis.on('click', function(entity) {
                entitySelect.select(entity);
            });
        });

        entitySelect.select = function(entity) {
            chart.model.addSelectedEntity(entity);
            entitySelect.clean();
/*            entitySelect.update({ searchString: "" }, function() {
                entitySelect.searchInput.node().focus();
            });*/
        };

        entitySelect.beforeClean(function() {
            if (entitySelect.el) entitySelect.el.remove();
            d3.select(window).on('entitySelect.clean', null);
        });

        return entitySelect;
    };
})(d3v4);