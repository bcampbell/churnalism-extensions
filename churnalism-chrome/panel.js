
var tmpl = {
  notTracking: document.getElementById("not-tracking-tmpl").innerHTML,
  pleaseWait: document.getElementById("please-wait-tmpl").innerHTML,
  matchesNotFound: document.getElementById("matches-not-found-tmpl").innerHTML,
  matchesFound: document.getElementById("matches-found-tmpl").innerHTML
};

function display(state,options) {
  if( state === undefined ||state === null ) {
    $('#content').html(Mustache.render(tmpl.notTracking,{}));
    $('.do-lookup').click(function() {
      doLookup();
    });
    return;
  }

  if( !state.pageDetails ) {
    $('#content').html(Mustache.render(tmpl.pleaseWait,{msg:"The page is still loading"}));
    return;
  }
 
  if( !state.lookupResults ) {
    $('#content').html(Mustache.render(tmpl.pleaseWait,{msg:"Checking with churnalism.com"}));
    return;
  }

  // bind on all the helper functions that didn't get passed through with the data
  var results = addHelpers(state.lookupResults);


  if(results.associations.length > 0 ) {
    $('#content').html(Mustache.render(tmpl.matchesFound, results));

    // now format and insert each matching document
    /*
    var prList = $('.results-list');
    _.each( results.associations, function(doc) {
      doc.parent = results;
      prList.append(matchTemplate(doc));
    });
    */
  } else {
    $('#content').html(Mustache.render(tmpl.matchesNotFound, {}));
  }

  if(state.currentlyHighlighted == null) {
  } else {
    $("#"+state.currentlyHighlighted).addClass("is-highlighted");
  }

  $('.match-item').click(function() {
    if($(this).is('.is-highlighted')) {
      $('.match-item').removeClass('is-highlighted');
      highlightOff();
    } else {
      $('.match-item').removeClass('is-highlighted');
      $(this).addClass('is-highlighted');
      highlightOn(this.id);
    }
  });

}


/* start CHROME */

var bg = chrome.extension.getBackgroundPage();

// in chrome, the popup will close every time we change tabs anyway,
// so ok to stash the tabId on startup to avoid tabs.query()+callbacks everywhere!
var ourTabId = null;



/* when popup is opened show state for current tab (afterwards, background
   will call display() again if state changes */
chrome.tabs.query({active: true, lastFocusedWindow: true, windowType: 'normal'}, function(tabs) {
  if(tabs.length>0) {
    ourTabId = tabs[0].id;
    display(bg.getState(tabs[0].id), bg.options);
  }
});

function doLookup() {
  console.log("doLookup()"); 
}

function highlightOn(docId) {
  bg.doHighlightOn(ourTabId,docId);
}

function highlightOff() {
  bg.doHighlightOff(ourTabId);
}

/* end CHROME */


