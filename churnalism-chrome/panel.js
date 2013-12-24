
var tmpl = {
  notTracking: document.getElementById("not-tracking-tmpl").innerHTML,
  pleaseWait: document.getElementById("please-wait-tmpl").innerHTML,
  lookupFailed: document.getElementById("lookup-failed-tmpl").innerHTML,
  matchesNotFound: document.getElementById("matches-not-found-tmpl").innerHTML,
  matchesFound: document.getElementById("matches-found-tmpl").innerHTML
};

function display(state,options) {
  if( state === undefined ||state === null ) {
    $('#content').html(Mustache.render(tmpl.notTracking, {shouldAllowManualCheck: shouldAllowManualCheck}));
    $('.do-lookup').click(function() {
      doLookup();
    });
    return;
  }

  if( !state.pageDetails ) {
    $('#content').html(Mustache.render(tmpl.pleaseWait,{msg:"The page is still loading"}));
    return;
  }
 
  if( state.lookupState =='pending') {
    $('#content').html(Mustache.render(tmpl.pleaseWait,{msg:"Checking with churnalism.com"}));
    return;
  }
  if( state.lookupState =='error') {
    $('#content').html(Mustache.render(tmpl.lookupFailed,{}));
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


/* ----- start CHROME ----- */

var bg = chrome.extension.getBackgroundPage();

// in chrome, the popup will close every time we change tabs anyway,
// so ok to stash the tabId on startup to avoid tabs.query()+callbacks everywhere!
var ourTabId = null;
var ourURL = "";


// when popup is opened show state for current tab (afterwards, background
// will call display() again if state changes.
chrome.tabs.query({active: true, lastFocusedWindow: true, windowType: 'normal'}, function(tabs) {
  if(tabs.length>0) {
    var tab = tabs[0];
    ourTabId = tab.id;
    ourURL = tab.url;
    display(bg.getState(tab.id), bg.options);
  }
});


function shouldAllowManualCheck() { return bg.isValidURL(ourURL); }
function doLookup() { bg.doLookup(ourTabId); }
function highlightOn(docId) { bg.doHighlightOn(ourTabId,docId); }
function highlightOff() { bg.doHighlightOff(ourTabId); }

/* ----- end CHROME ----- */


/* ----- start FIREFOX -----

function shouldAllowManualCheck() { return true; } // TODO

function doLookup() { self.port.emit('doLookup'); }
function highlightOn(docId) { self.port.emit('doHighlight', docId); }
function highlightOff() { self.port.emit('noHighlight'); }

self.port.on("bind", function(state,options) {
  display(state,options);
});

----- end FIREFOX ----- */


