var widget = require("widget");
var tabs = require("tabs");
var pageMod = require("page-mod");
var Panel = require("panel").Panel;
var MatchPattern = require("match-pattern").MatchPattern;
var data = require("self").data; 


var windows = require("windows");
var SimplePrefs = require("simple-prefs");
var SimpleStorage = require("simple-storage"); 

// our local modules
var news_sites = require("news_sites");
var TabState = require("tabstate").TabState;
var parseUri = require("parseuri").parseUri;


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




