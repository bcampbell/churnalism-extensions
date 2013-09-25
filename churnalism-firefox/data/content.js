var log = new LogWrapper(LogWrapper.DEBUG);

var standardize_quotes = function (text, leftsnglquot, rightsnglquot, leftdblquot, rightdblquot) {
    return text.replace(/[\u2018\u201B]/g, leftsnglquot)
               .replace(/[\u0027\u2019\u201A']/g, rightsnglquot)
               .replace(/[\u201C\u201F]/g, leftdblquot)
               .replace(/[\u0022\u201D"]/g, rightdblquot);
};

var extract_article = function () {
    var article = '';
    var title = '';
    try {
        ArticleExtractor(window, LogWrapper.CRITICAL);
        var article_document = new ExtractedDocument(document);
        article = article_document.get_article_text();
//        article = standardize_quotes(article, "'", "'", '"', '"');
        log.info("Article text: ", article);
        title = article_document.get_title();
        //inject_warning_ribbon();
    } catch (e) {
        log.info("UHOH - extract failed: ", e.message);
        article = '';
        title = '';
    }

    pageDetails = {'title': title, 'text': article};
    self.port.emit("textExtracted", pageDetails);
    /*
    emitrr.sendRequest({
        method: 'articleExtracted',
        text: article,
        title: title,
        url: window.location.href
    });
    */
};



/*
    var prevent_scroll = function (event) {
        event.preventDefault();
        event.stopPropagation();
        return false;
    };

    var inject_warning_ribbon = function (ribbon_url, match_url, loading_url) {
        $("#churnalism-ribbon").remove();

//        css_url = Churnalism.options.search_server + '/static/styles/ffextpagecontext.css';
//        jQuery("<link>").attr('rel', 'stylesheet').attr('type', 'text/css').attr('href', css_url).appendTo("head");

        var ribbon_frame = $('<div id="churnalism-ribbon" name="churnalism-ribbon" style="display: none;"><div class="fook">Wheeeeeeee!</div></div>');
        ribbon_frame.prependTo('body');
            ribbon_frame.slideDown(400).show();
    };
*/
extract_article();

