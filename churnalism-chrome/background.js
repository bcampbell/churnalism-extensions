Gatso.start('startup');

/* extension options - (loaded from storage in startup() and changed via storeOptions() */
options = {};


/* map from tab ids to workers */
// TODO: use this also for our state tracking?
tabmap = {};


function getState(tabId) {
  if(tabId in tabmap) {
    return tabmap[tabId].state;
  } else {
    return null;
  }
}


/**********************************
 * Gray area - public interface, browser-specific implementation
 */

function getBuiltInWhiteList() {
  return NewsSites.sites;
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




/********************************
 * chrome-specific from here on
 */


function doHighlightOn(tabId,docElementId) {
  var state = getState(tabId);
  if(state===null) {
    return;
  }

  // calculate fragments of text to highlight
  var doc = _.find(state.lookupResults.associations, function(d) { return d.elementId()==docElementId });
  console.log(doc);
  if( !doc) {
    return;
  }
  var txt = state.lookupResults.text;
  var frags = _.map(doc.leftFragments, function(f) {
    return txt.substr(f[0],f[1]);
  });

  chrome.tabs.sendMessage(tabId,{'method':'highlight','frags':frags});


  state.currentlyHighlighted = docElementId;

}

function doHighlightOff(tabId) {
  chrome.tabs.sendMessage(tabId,{'method':'noHighlight'});
  var state = getState(tabId);
  if(state===null) {
    return;
  }

  // calculate fragments of text to highlight
  state.currentlyHighlighted = null;
}


/* update the gui (widget, popup) to reflect the current state
 * the state tracker object calls this every time something changes
 * (eg lookup request returns)
 */
function update_gui(tabId)
{
//  console.log(tabId + ": update_gui()");
  chrome.tabs.get(tabId, function(tab) {
    var state = getState(tab.id);

    // update the Browser Action button
    var badgeText = "";
    var icon = "icon-off.png";
    var tooltip = "Churnalism findings";
    if(state && state.isLookupReady()) {
      icon = "icon.png";
      if(state.lookupResults.associations.length >0) {
        badgeText = "" + state.lookupResults.associations.length;
      }
    } else {
    }
    chrome.browserAction.setBadgeText( {text: badgeText, tabId: tab.id});
    chrome.browserAction.setIcon( {path:icon, tabId: tab.id});
    chrome.browserAction.setTitle( {title: tooltip, tabId: tab.id});

    if(tab.active) {
      // update popup, if shown
      var popups = chrome.extension.getViews({type: "popup",windowId: tab.windowId});
      if(popups.length>0) {
        popups[0].display(state,options);
      }
    }

    // check for notification reqs
    if( state!==null && state.churnAlertPending ) {
      // TODO: want to show an infobar here... but API is experimental still :-(
//      notifyChurn(state);
      state.churnAlertPending = false;
    }
  });
}





// TODO: popup handling here!
// - manual lookup


// execute a list of scripts, in order
var executeScriptsSynchronously = function (tab_id, files, callback) {
    if (files.length > 0) {
        var file = files[0];
        console.log("inject " + file);
        var rest = files.slice(1);
        chrome.tabs.executeScript(tab_id, {file: file}, function(){
            if (rest.length > 0) {
                executeScriptsSynchronously(tab_id, rest, callback);
            } else if (callback) {
                callback.call(null);
            }
        });
    }
};

var contentScripts = [ "lib/jquery-1.7.1.min.js",
    "compat.js",
    "logwrapper.js",
    "extractor.js",
    "highlight.js",
    "gatso.js",
    "content.js" ];


function initListeners() {
  // install hook so we know when user starts loading a new page
  // (called after http redirects have been handled)
  chrome.webNavigation.onCommitted.addListener(function(details) {
    if(details.frameId != 0)
      return;
    // ignore generated transitions (eg due to chrome instant)
    if(details.transitionType == 'generated')
      return;

//    console.log("onCommitted tabid=", details.tabId, "url=",details.url, "transitionType=", details.transitionType);

    // if site is whitelisted (and not blacklisted), start tracking the tab
    var url = details.url;
    var tabId = details.tabId;
    if( onWhitelist(url) ) {
      if( !onBlacklist(url) ) {
        console.log("tab " + tabId + ": tracking", url);
        var state = new TabState(url, function(state) { update_gui(tabId);} );
        tabmap[tabId] = { 'state': state};
        executeScriptsSynchronously(tabId, contentScripts);
        chrome.tabs.insertCSS(tabId,{file:'content.css'});
        update_gui(tabId);
      } else {
        console.log("backlisted: ", url);
      }
    } else {
        console.log("not on whitelist: ", url);
    }

  });

  chrome.tabs.onActivated.addListener(function(activeInfo) {
    update_gui(activeInfo.tabId);
  });

  chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
    if(tabId in tabmap) {
      delete tabmap[tabId];
    }
  });


  chrome.runtime.onMessage.addListener( function(req, sender, sendResponse) {
//    console.log( "background.js: received "+ req.method + " from tab "+sender.tab.id);
//    console.log(req);

    var state = getState(sender.tab.id);
    if( !state )
      return; // we're not covering this page
    if(req.method == "textExtracted") {
      // content script has read the article text - we can start a lookup now
      state.textReady(req.pageDetails);
    }
  });
}





function startup() {
  var default_options = {
    'search_server':'http://unsourced.org',
    'debug': false,
    'show_overlays': true,
    'user_whitelist': [],
    'user_blacklist': []
  };

/*  CHROME version */
  /*
    chrome.storage.sync.get(default_options, function(items) {
    options = items;
    });
    */

  options = default_options;

/* FIREFOX version*/
    /*
  if(!SimpleStorage.storage.options)
    SimpleStorage.storage.options = default_options;
  options = SimpleStorage.storage.options;
*/

  // continue startup
  compileWhitelist();
  compileBlacklist();

  initListeners();
}

console.log("starting up");
startup();
//tabs.open(data.url("intro.html"));
console.log("startup done");
Gatso.stop('startup');
Gatso.report();



