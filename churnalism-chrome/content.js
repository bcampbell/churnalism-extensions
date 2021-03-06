var log = new LogWrapper(LogWrapper.DEBUG);
var highlightClass = "churn-highlight";

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

  return pageDetails;
};


// highlight any text on the page matching any of the strings in frags
function doHighlight(frags) {

  // zap any previous highlight
  removeHighlight();

  // highlight all the fragment strings
  Gatso.start("highlight-prep");

  // munge all the fragements into a big regex
  for (var i=0; i<frags.length; ++i) {
    var f = frags[i];

    // TODO: handle html entities. Some punctuation, some whitespace
    // (eg nbsp), some text (eg accented chars)

    // make punctuation optional
    f = f.replace(/[^\\\w\s]+/g, "\\W*");

    // be tolerant of whitespace changes
    f = f.replace(/\s+/g, "\\s+");

    f = "(?:" + f + ")";
    frags[i] = f;
  }

  var pat = new RegExp(frags.join("|"),"gi");

  Gatso.stop("highlight-prep");


  Gatso.start("highlight-find");
  var ranges = findText(pat);
  Gatso.stop("highlight-find");

  Gatso.start("highlight-apply");
  highlightRanges(ranges, highlightClass);
  Gatso.stop("highlight-apply");
  Gatso.report();
};


// remove highlighing from the page
function removeHighlight() {
  $("span." + highlightClass).each(function() {
			this.parentNode.firstChild.nodeName;
			with(this.parentNode) {
				replaceChild(this.firstChild, this);
				normalize();
			}
  });
};


/* start CHROME */

// warning bar - this'd work on firefox, but seems better to use the built-in
// notification-box. Should replace this with infobar in chrome, whenever it
// makes it into the main releases...
function showWarningBar(msg) {
  $("#churn-warningbar").remove();

  // note: files used must be whitelisted in manifest
  var imgURL = chrome.extension.getURL("warnbar-icon.png");
  var bar = $('\
<div id="churn-warningbar">\
  <div class="churn-inner">\
    <img src="'+imgURL+'" />\
    <span class="churn-msg">' + msg + '</span>\
    <!-- <a class="churn-btn churn-btn-more" href="">More details...</a> -->\
    <a href="" class="churn-btn churn-btn-close">&#10006;</a>\
  </div>\
</div>\
');
  bar.prependTo('body').hide().slideDown(200, function() {
    $("#churn-warningbar .churn-btn-close").click( function() {
      $("#churn-warningbar").slideUp(200);
      return false;
    });

    $("#churn-warningbar .churn-btn-more").click( function() {
      chrome.runtime.sendMessage({'method': 'showPanel'});
      $("#churn-warningbar").slideUp(200);
      return false;
    });
  });
}


$( document ).ready( function() {
  var details = extract_article();
  chrome.runtime.sendMessage({'method': 'textExtracted', 'pageDetails': details});
});

chrome.runtime.onMessage.addListener(function(req, sender, sendResponse) {
    // Do something
    //
    switch( req.method) {
      case "highlight":
        doHighlight(req.frags);
        break;
      case "noHighlight":
        removeHighlight();
        break;
      case "showWarningBar":
        showWarningBar(req.msg);
        break;
    }
});

/* end CHROME */

/* start FIREFOX

$( document ).ready( function() {
  var details = extract_article();
  self.port.emit("textExtracted", pageDetails);
});
self.port.on('highlight', function(frags) { doHighlight(frags) });
self.port.on('noHighlight', function() { removeHighlight() });
end FIREFOX */

