    
    var sp_titleinfo = $("#sp_titleinfo");
    var sp_urlinfo = $("#sp_urlinfo");
    var sp_descriptioninfo = $("#sp_descriptioninfo");

    var sp_resulttitle = $("#sp_resulttitle");
    var sp_resulturl = $("#sp_resulturl");
    var sp_resultdescription = $("#sp_resultdescription");
    
    var sp_titlesizer = $("#sp_titlesizer");
    var sp_urlsizer = $("#sp_urlsizer");
    var sp_descriptionsizer = $("#sp_descriptionsizer");
    
    String.prototype.trimEnd = function (c) {
        c = c ? c : ' ';
        var i = this.length - 1;
        for (; i >= 0 && this.charAt(i) == c; i--);
        return this.substring(0, i + 1);
    }

    function wordCount(text) {
        var m = text.match(/\S+/g);

        if (m)
            return m.length;

        return 0;
    }
    function htmlEncode(value) {
        //create a in-memory div, set it's inner text(which jQuery automatically encodes)
        //then grab the encoded contents back out.  The div never exists on the page.
        return $('<div/>').text(value).html();
    }

    function htmlDecode(value) {
        return $('<div/>').html(value).text();
    }
    function sp_updateurl() {
        var rawurl = $.trim(sp_url.val());
        var url = htmlEncode(rawurl);

        url = url.replace(new RegExp("(.*://)", "g"), "");

        if (url.length > 0 && url.indexOf("/") < 0)
            url += "/";

        rawurl = url;


        sp_urlsizer.html(url);
        sp_urlinfo.html("" + rawurl.length + " characters, " + sp_urlsizer.width() + " pixels");

        var folder = new RegExp("(/[^./]+[^/]*/)");

        while (sp_urlsizer.width() > 380) {
            url = $.trim(url.trimEnd('.'));

            var newUrl = url.replace("<b>", "").replace("</b>", "");

            newUrl = newUrl.replace(folder, "/.../");

            newUrl = newUrl.replace("/.../.../", "/.../");

            if (newUrl.length >= url.length) {
                // failed to shrink more. force crop it
                newUrl = newUrl.substring(0, newUrl.length - 1) + "...";
            }

            url = newUrl;
            sp_urlsizer.html(url);
        }

        sp_resulturl.html(url);
    }

    function sp_updatetitle() {
        var rawTitle = $.trim(sp_title.val());
        var title = htmlEncode(rawTitle);

        sp_titlesizer.html(title);

        sp_titleinfo.html("" + rawTitle.length + " characters, " + sp_titlesizer.width() + " pixels, " + wordCount(rawTitle) + " words");


        var lastWord = new RegExp("\\S+$");

        while (sp_titlesizer.width() > 512) {
            title = $.trim(title.replace(" <b>...</b>", ""));

            var newTitle = title;

            newTitle = $.trim(newTitle.replace(lastWord, ""));

            if (newTitle.length >= title.length) {
                newTitle = newTitle.substring(0, newTitle.length - 1);
            }
            title = newTitle + " <b>...</b>";
            sp_titlesizer.html(title);
        }

        sp_resulttitle.html(title);
    }
    
    function sp_updatedescription() {
        var rawDescription = $.trim(sp_description.val());
        var description = htmlEncode(rawDescription);

/*
        sp_descriptionsizer.html(description);

        sp_descriptioninfo.html("" + rawDescription.length + " characters, " + sp_descriptionsizer.width() + " pixels, " + wordCount(rawDescription) + " words");

        var lastWord = new RegExp("\\S+$");

        while (rawDescription.length > 157) {
            description = $.trim(description.replace(" <b>...</b>", ""));

            var newDescription = description;

            newDescription = $.trim(newDescription.replace(lastWord, ""));
            rawDescription = $.trim(rawDescription.replace(lastWord, ""));

            if (newDescription.length >= description.length) {
                newDescription = newDescription.substring(0, newDescription.length - 1);
                rawDescription = rawDescription.substring(0, rawDescription.length - 1);
            }
            description = newDescription + " <b>...</b>";
            sp_descriptionsizer.html(description);
        }
*/
        sp_resultdescription.html(description);
    }
    function sp_updateall() {
        sp_updateurl();
        sp_updatetitle();
        sp_updatedescription();
    }

