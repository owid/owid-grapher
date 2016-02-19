var rapyd = rapyd || {};

rapyd.datatree = {
    updateForm: function (el, form, name) {
        form.find('datatree-values').html();
        var data = el.nestable('serialize');
        $('<input>')
            .attr('type', 'hidden')
            .attr('name', name)
            .attr('value', JSON.stringify(data))
            .appendTo(form);
        return true;
    },
    updateDepth: function (ol, depth) {
        if (!ol.length) return;
        depth = depth || 1;
        ol.attr("data-depth", depth);
        var li = ol.children(".datatree-item");
        li.attr("data-depth", depth);
        rapyd.datatree.updateDepth(li.children(".datatree-list"), depth + 1);
    }
};



//var