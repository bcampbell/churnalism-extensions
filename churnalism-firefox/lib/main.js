var widget = require("widget");
var tabs = require("tabs");
var pageMod = require("page-mod");
var Request = require("request").Request;
var Panel = require("panel").Panel;
var MatchPattern = require("match-pattern").MatchPattern;
var data = require("self").data; 

var parseUri = require("parseuri").parseUri;

var news_sites = require("news_sites");
var windows = require("windows");
var SimplePrefs = require("simple-prefs");
var SimpleStorage = require("simple-storage"); 


// This file is divided up into three sections, in order:
// 1) neutral code - shared between firefox/chrome/whatever
// 2) grey areas - needs a little more refeactoring
// 3) platform-specific
// Take this all with a grain of salt - things are likely to
// continue breaking for a while.



//
// platform-neutral stuff starts here.

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
  // might already be a popup active
  this._guiUpdateFunc(this);
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
    //

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




/* end TabState */







/* extension options - (loaded from storage in startup() and changed via storeOptions() */
options = {};


// returns a function that can test a url against the list of sites
// a leading dot indicates any subdomain will do, eg:
//   .example.com             - matches anything.example.com
// a trailing ... is a wildcard, eg:
//   example.com/news/...    - matches example.com/news/moon-made-of-cheese.html
function buildMatchFn(sites) {

  var matchers = sites.map(function(site) {
    var pat = site;
    var wild_host = (pat[0]=='.');
    var wild_path = (pat.slice(-3)=='...');

    if(wild_host) {
      pat = pat.slice(1);
    }
    if(wild_path) {
      pat = pat.slice(0,-3);
    }

    pat = pat.replace( /[.]/g, "[.]");

    if(wild_host) {
      pat = '[^/]*' + pat;
    }

    pat = "https?://" + pat + '.*';

    return new RegExp(pat);
  });


  return function (url) {
    for (var idx = 0; idx < matchers.length; idx++) {
      var re = matchers[idx];
        if( re.test(url)) {
              return true;
        }
    }
    return false;
  };
}


/**********************************
 * Gray area - public interface, browser-specific implementation
 */

function getBuiltInWhiteList() {
  return news_sites.sites;
}

function getBuiltInBlackList() {
  return [];
}

//
function storeOptions(new_options) {
  for (key in new_options) {
    options[key] = new_options[key];
  }
//  console.log("save options: ", options);
// chrome version:
//  chrome.storage.sync.set(options);
  SimpleStorage.storage.options = options;

  // perform any processing the changes require
  if( 'user_whitelist' in new_options ) {
    compileWhitelist();
  }
  if( 'user_blacklist' in new_options ) {
    compileBlacklist();
  }


  if( 'show_overlays' in new_options ) {
    // TODO: update overlays in existing tabs
    // (tried this, but ran into problem with tabs.sendMessage() not returning...
    // try again another time)
  }
}


var onWhitelist = function (location) {
  // This function is replaced by compileWhitelist
  return false;
};

var onBlacklist = function (location) {
  // This function is replaced by compileBlacklist
  return true;
};


// replace onWhitelist with a function that returns true for whitelisted sites
var compileWhitelist = function () {
//  console.log("Recompiling onWhitelist");
  var sites = getBuiltInWhiteList().concat(options.user_whitelist);
  onWhitelist = buildMatchFn(sites);
};

// replace onBlacklist with a function that returns true for blacklisted sites
var compileBlacklist = function () {
//  console.log("Recompiling onBlacklist");
  var sites = getBuiltInBlackList().concat(options.user_blacklist);
  onBlacklist = buildMatchFn(sites);
};







/********************************
 * firefox-specific from here on
 */





/* update the gui to reflect the current state
 * the state tracker object calls this every time something changes
 * (eg lookup request returns)
 */
function update_gui(worker,state)
{

  update_widget(worker.tab);
}



// update widget and popup window
function update_widget(tab)
{
  var state = tab.ourstate;
  var widget = ourWidget.getView(tab.window);

  if( state === undefined || state === null ) {
    // not tracking this tab
    widget.port.emit('reconfig', {'msg':  "Page not yet loaded"});
    widget.tooltip = "churnalism extension";
  } else {
    // reflect the state
    var msg = state.calcWidgetTooltip();
    widget.port.emit('reconfig', {'msg': msg});
    widget.tooltip = state.calcWidgetTooltip();
  }

  // if the tab is active, update the popup window
  if(tabs.activeTab===tab) {
    ourPanel.port.emit('bind', state, options);
  }
}



ourPanel = Panel( {
  contentURL: data.url("panel.html"),
  contentScriptFile: [data.url("ashe.js"),data.url("panel.js")],
  width: 400,
  height: 600,
});

ourPanel.on('show', function() {
  var state = tabs.activeTab.ourstate;
  if(state === undefined) {
    ourPanel.port.emit('bind', null,options);
  } else {
    ourPanel.port.emit('bind', state,options);
  }
});




function installPageMod() {

  pageMod.PageMod({
    include: [ "http://*", "https://*" ],
    contentScriptWhen: 'ready',
    attachTo: 'top',  // only attach to top, not iframes
    contentScriptFile: [data.url("logwrapper.js"),
        data.url("extractor.js"),
        data.url("jquery-1.7.1.min.js"),
        data.url("content.js")],
    contentStyleFile: [data.url("ffextpagecontext.css")],
    onAttach: function(worker) {
      console.log("attaching pagemod");
      var url = worker.url;
      // we store some extra state on the tab
      var state = new TabState(url, function (state) {update_gui(worker,state);});
      worker.tab.ourstate = state;
      update_gui(worker,state);

      // update our state when page text has been extracted...
      worker.port.on('textExtracted', function(pageDetails) {
        state.textReady(pageDetails);
      });


    }
  });
}


function installWidget() {
  return widget.Widget({
    id: "our-widget",
    label: " ",
    width: 200,
    contentURL: data.url("widget.html"),
    contentScriptFile: data.url("widget.js"),
    panel: ourPanel
  });
}

tabs.on('activate', update_widget );

function startup() {
  var default_options = {
    'search_server':'http://unsourced.org',
    'debug': false,
    'show_overlays': true,
    'user_whitelist': [],
    'user_blacklist': []
  };

/*  CHROME VERSION
    chrome.storage.sync.get(default_options, function(items) {
    options = items;
*/
  if(!SimpleStorage.storage.options)
    SimpleStorage.storage.options = default_options;

  options = SimpleStorage.storage.options;

  // continue startup
  compileWhitelist();
  compileBlacklist();

  installPageMod();
}

console.log("starting up");
ourWidget = installWidget();
startup();
console.log("startup done");




