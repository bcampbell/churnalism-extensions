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
//        log.info("Article text: ", article);
        log.debug("Article text extracted");
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

self.port.on('highlight', function(frags) {
  console.log("highlighting " + frags.length + " frags")


  // zap any previous highlight
  removeHighlight();

  // highlight all the fragment strings
  gatsoStart("highlight-prep");

  // munge all the fragements into a big regex
  for(var i=0; i<frags.length; ++i) {
    var f = frags[i];

    // TODO: handle html entities. Some punctuation, some whitespace
    // (eg nbsp), some text (eg accented chars)

    // make punctuation optional
    f = f.replace(/[^\\\w\s]+/g, "\\W*");

    // be tolerant of whitespace changes
    f = f.replace(/\s+/g, "\\s+");

/*
    console.log( '"' + frags[i] +'"' );
    console.log( ' -> "' + f + '"' );
*/
    f = "(?:" + f + ")";
    frags[i] = f;
  }

  var pat = new RegExp(frags.join("|"),"gi");

  gatsoStop("highlight-prep");


  gatsoStart("highlight-find");
  var ranges = findText(pat);
  gatsoStop("highlight-find");

  gatsoStart("highlight-apply");
  highlightRanges(ranges);
  gatsoStop("highlight-apply");
  gatsoReport();
});

self.port.on('unhighlight', function() {
  removeHighlight();
});

function removeHighlight() {
  $('span.highlight').each(function() {
			this.parentNode.firstChild.nodeName;
			with(this.parentNode) {
				replaceChild(this.firstChild, this);
				normalize();
			}
  });
}





$( document ).ready( function() {
  extract_article();
});


