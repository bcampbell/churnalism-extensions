console.log("IN Content.js");
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
    } catch (e) {
        log.info("UHOH - extract failed: ", e.message);
        article = '';
        title = '';
    }

    /*
    emitrr.sendRequest({
        method: 'articleExtracted',
        text: article,
        title: title,
        url: window.location.href
    });
    */
};


extract_article();

