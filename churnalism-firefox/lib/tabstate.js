/* ----- start FIREFOX ----- */
var Request = require("sdk/request").Request;
var cookSearchResults = require("match").cookSearchResults;
var addHelpers = require("match").addHelpers;
/* ----- end FIREFOX ----- */

// TabState tracks all the stuff we want to track for each tab
//   - data about the page sent from the content script
//   - progress of request to churnalism server

function TabState(url, guiUpdateFunc) {
  this.url = url;
  this.contentReady = false;
  this._guiUpdateFunc = guiUpdateFunc;

  this.lookupState = "none"; // none, pending, ready, error
  this.lookupResults = null;  // only set if state is 'ready'

  this.pageDetails = null; // info from content script, set by textReady()

  // elementId ('doc-xx-yy') of document currently highlighted
  this.currentlyHighlighted = null;

  // do we want to notify the user?
  this.churnAlertPending = false;
}


TabState.prototype.lookupFinished = function(lookupResults) {

  console.log("lookupFinished");
  if(this.lookupState=="none" || this.lookupState=="pending") {

    // add the text we searched on - server doesn't return it
    lookupResults.text = this.pageDetails.text;
    // server also leaves out associations member if no results.
    // add it in here to make other code easier
    if( lookupResults.associations === undefined ) {
      lookupResults.associations = [];
    }

    lookupResults = cookSearchResults(lookupResults);
    // filter out the current page from the results
    lookupResults.associations = lookupResults.associations.filter( function(doc) {return doc.metaData.permalink != this.url;}, this);


    // slap on some helper functions
    lookupResults = addHelpers(lookupResults);
//    console.log(JSON.stringify(this.lookupResults,null," "));

    // filter out very low-rating matches (TODO: should the server do this?)
    lookupResults.associations = lookupResults.associations.filter( function(doc) {
      return doc.score()>0;
    });

    // if there's churn, set flag to pop up a notfiifcation (used and cleared by the gui update fn)
    if(lookupResults.associations.length > 0 ) {
      this.churnAlertPending = true;
    }
    this.lookupResults = lookupResults;
    this.lookupState = "ready";
    this._guiUpdateFunc(this);
  }
};

TabState.prototype.lookupError = function() {
  console.log("lookupError");
  this.lookupState = "error";
  this._guiUpdateFunc(this);
};


// to be called when the text from an article is extracted
TabState.prototype.textReady = function(pageDetails) {
  console.log("textReady called: " + pageDetails['title']);
  this.pageDetails = pageDetails;
  if(this.contentReady!==true) {
    this.contentReady = true;
    this.startLookup();
  }
};



TabState.prototype.startLookup = function() {
  var state = this;
  var search_url = "http://churnalism.com/search";

  console.log("startLookup("+this.url+")");
  this.lookupState = "pending";
  this._guiUpdateFunc(this);

  /* ----- start FIREFOX ----- */
  var req = Request({
    url: search_url,
    content: { title: this.pageDetails.title,
      text: this.pageDetails.text
    },
    onComplete: function (response) {
      if( response.status==200) {
        state.lookupFinished(response.json);
      } else {
        state.lookupError();
      }
    }
    // TODO: onError?
  }).post();
  /* ----- end FIREFOX ----- */

  /* ----- start CHROME -----
  var xhr = new XMLHttpRequest();
  var params = "title=" + encodeURIComponent(this.pageDetails.title) +
    "&text=" + encodeURIComponent(this.pageDetails.text);
  xhr.open("POST", search_url, true);
  xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  xhr.onload = function() {
    if( this.status == 200 ) {
      var resp = JSON.parse(this.responseText);
      state.lookupFinished(resp);
    } else {
      state.lookupError();
    }
  };
  xhr.onerror = function() { state.lookupError(); };
  xhr.onabort = function() { state.lookupError(); };
  xhr.send(params );
  ----- end CHROME ----- */
};



// some helpers for use in panel.html template
TabState.prototype.isLookupNone = function() { return this.lookupState == 'none'; };
TabState.prototype.isLookupReady = function() { return this.lookupState == 'ready'; };
TabState.prototype.isLookupPending = function() { return this.lookupState == 'pending'; };
TabState.prototype.isLookupError = function() { return this.lookupState == 'error'; };

TabState.prototype.isDebugSet = function() { return options.debug; };
TabState.prototype.getDebugTxt = function() { return JSON.stringify(this,null," "); };




try {
  exports.TabState = TabState
} catch (e) {
  /* ignore - we're just not in a CommonJS environment */
}

