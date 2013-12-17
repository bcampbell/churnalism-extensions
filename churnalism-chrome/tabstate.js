/* FIREFOX */
/*
var Request = require("request").Request;
var cookSearchResults = require("match").cookSearchResults;
var addHelpers = require("match").addHelpers;
*/


// TabState tracks all the stuff we want to track for each tab

/* NOTES:
 * we've got a couple of things to track for each augmented page:
 * 1) the lookup request to server. We want to kick this off as early
 *    as we can.
 * 2) the state of the page content. We can't display any overlays until the
 *    page is ready.
 * We track the states of these by adding an object to the tab object.
 */



function TabState(url, guiUpdateFunc) {
  this.url = url;
  this.contentReady = false;
  this._guiUpdateFunc = guiUpdateFunc;

  this.lookupState = "none"; // none, pending, ready, error
  this.lookupResults = null;  // only set if state is 'ready'

  this.pageDetails = null; // set by textReady()

  // elementId ('doc-xx-yy') of document currently highlighted
  this.currentlyHighlighted = null;

  // do we want to notify the user?
  this.churnAlertPending = false;
  // might already be a popup active
//  this._guiUpdateFunc(this);
}

TabState.prototype.lookupFinished = function(lookupResults) {
  /*
  console.log("lookupFinished");
  console.log("--------------------------");
  if(lookupResults.success) {
    console.log("SUCCESS");
    var r = lookupResults;
    console.log("Totalrows=" + r.totalRows);
    console.log("associations: " + r.associations.length);
    for (var i=0; i<r.associations.length; i++) {
      var as = r.associations[i];
      var meta = as.metaData;
      console.log(meta.type + "("+ meta.source + "): " + meta.permalink);
    }
  } else {
    console.log("FAILED");
  }
  console.log("--------------------------");
*/

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
  var search_url = "http://new.churnalism.com/search/";

  console.log("startLookup("+this.url+")");
  this.lookupState = "pending";
  this._guiUpdateFunc(this);

  // TODO: factor out platform-specific requests

  /* firefox version */
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
    /* TODO: onError? */
  }).post();
  /* chrome version */
  /*
  $.ajax({
    type: "GET",
    url: search_url,
    dataType: 'json',
    success: function(result) {
      state.lookupFinished(result);
    },
    error: function(jqXHR, textStatus, errorThrown) {
      state.lookupError();
      console.log("Error:", jqXHR, textStatus, errorThrown);
    }
  });
  */
};



// some helpers for use in panel.html template (ashe can only do boolean if statements)
TabState.prototype.isLookupNone = function() { return this.lookupState == 'none'; };
TabState.prototype.isLookupReady = function() { return this.lookupState == 'ready'; };
TabState.prototype.isLookupPending = function() { return this.lookupState == 'pending'; };
TabState.prototype.isLookupError = function() { return this.lookupState == 'error'; };

TabState.prototype.isDebugSet = function() { return options.debug; };
TabState.prototype.getDebugTxt = function() { return JSON.stringify(this,null," "); };

TabState.prototype.wasArticleFound = function() { return this.lookupState == 'ready' && this.lookupResults.status=='found'; };

TabState.prototype.isSourcingRequired = function() {
  if( this.wasArticleFound() ) {
    return this.lookupResults.needs_sourcing;
  }
  
  if( this.pageDetails && !this.pageDetails.isDefinitelyNotArticle && this.pageDetails.indicatorsFound ) {
    return true;
  }
  return false;
};





TabState.prototype.calcWidgetIconState = function() {
  return "";
};



TabState.prototype.calcWidgetTooltip = function() {
  var tooltip_txt = "";
  switch( this.lookupState ) {
    case "none":
      tooltip_txt = "waiting for page to load...";
      break;
    case "pending":
      tooltip_txt = "checking new.churnalism.com...";
      break;
    case "ready":
      {
        /*
        var ad = this.lookupResults;
        if( ad.status=='found') {
          var src_txt;
          switch(ad.sources.length) {
            case 0: src_txt="no sources"; break;
            case 1: src_txt="1 source"; break;
            default: src_txt="" + ad.sources.length + " sources"; break;
          }
          var label_txt;
          switch(ad.labels.length) {
            case 0: label_txt="no warning labels"; break;
            case 1: label_txt="1 warning label"; break;
            default: label_txt="" + ad.labels.length + " warning labels"; break;
          }
          tooltip_txt = src_txt + ", " + label_txt;
        } else {
          tooltip_txt = "no sources or warning labels";
        } 
        */
        tooltip_txt = "Search complete:";
        var r = this.lookupResults;
        if( r.success) {
          tooltip_txt += " " + r.associations.length + " matches";
        } else {
          tooltip_txt += " failed";
        }
      }
      break;
    case "error":
      tooltip_txt = "Error";
      break;
  }

  return tooltip_txt;
};



try {
  exports.TabState = TabState
} catch (e) {
  /* ignore - we're just not in a CommonJS environment */
}




