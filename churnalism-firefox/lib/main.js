var widget = require("widget");
var tabs = require("tabs");
var pageMod = require("page-mod");
var Panel = require("panel").Panel;
var MatchPattern = require("match-pattern").MatchPattern;
var data = require("self").data; 


var windows = require("windows");
var SimplePrefs = require("simple-prefs");
var SimpleStorage = require("simple-storage"); 

var _ = require("underscore");

// our local modules
var gatso = require("gatso");
var news_sites = require("news_sites");
var TabState = require("tabstate").TabState;
var parseUri = require("parseuri").parseUri;

gatso.start('startup');

/* extension options - (loaded from storage in startup() and changed via storeOptions() */
options = {};


/* map from tab ids to workers */
// TODO: use this also for our state tracking?
tabmap = {};

function getWorker(tab) {
  if(tab.id in tabmap) {
    return tabmap[tab.id].worker;
  } else {
    return null;
  }
}

function getState(tab) {
  if(tab.id in tabmap) {
    return tabmap[tab.id].state;
  } else {
    return null;
  }
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
 * firefox-specific from here on
 */





/* update the gui (widget, popup) to reflect the current state
 * the state tracker object calls this every time something changes
 * (eg lookup request returns)
 */
function update_gui()
{
  tab = tabs.activeTab;
  var state = getState(tab);
  var widget = ourWidget.getView(tab.window);

  var icon = 'off';
  var msg = '';
  if( state !== undefined && state !== null ) {
    if( state.lookupResults ) {
      if( state.lookupResults.associations.length > 0 ) {
        icon = 'on';
        msg = "Churn Alert";
      } else {
        msg = "No matches";
      }
    } else {
      if(state.lookupState=="pending" || !state.pageDetails ) {
        msg = "working...";
      }
    }
  }
  msg = "";
  widget.port.emit('reconfig', {'msg': msg, 'icon': icon});
  widget.tooltip = "Churnalism information";

  // if the tab is active, update the popup window
  if(tabs.activeTab===tab) {
    ourPanel.port.emit('bind', state, options);

    // TESTING: dump out state as JSON to use in test_panel.html
    /*
    console.log("+++++++++++++++++++++++++++++");
    var foo = JSON.stringify(state);
    foo = foo.replace("\\","\\\\",'g')
    foo = foo.replace("'","\\'",'g')
    console.log("state = '" + foo + "';");
    console.log("+++++++++++++++++++++++++++++");
    */

    // show a notificationbox if one's been requested
    if( state!==null && state.churnAlertPending ) {
      notifyChurn(state);
      state.churnAlertPending = false;
    }
  }
}


function notifyChurn(state) {
  var n = state.lookupResults.associations.length;
  var msg = "Uh-oh... this article might be churnalism - ";
  if( n==1) {
    msg = msg + "1 match found";
  } else {
    msg = msg + n + " matches found";
  }

  var notification = require("notification-box").NotificationBox({
    'value': 'churn-alert',
    'label': msg,
    'priority': 'WARNING_HIGH',
    'image': "",  //self.data.url("gnu-icon.png"),
    'buttons': [{'label': "More details...",
      'onClick': function () {
        ourPanel.show({position:{ top:0,right:0}});
      }}]
  });
}




ourPanel = Panel( {
  contentURL: data.url("panel.html"),
  contentScriptFile: [
    data.url("jquery-1.7.1.min.js"),
    data.url("underscore.js"),
    data.url("underscore.string.js"),
    data.url("moment.min.js"),
    data.url("mustache.js"),
    // our stuff
    data.url("match.js"),
    data.url("panel.js")],
//  contentStyleFile: [data.url("bootstrap.min.css")],
  width: 500,
  height: 300,
});

ourPanel.on('show', function() {
  var state = getState(tabs.activeTab);
  if(state === undefined) {
    ourPanel.port.emit('bind', null,options);
  } else {
    ourPanel.port.emit('bind', state,options);
  }
});

// panel requests highlighting
ourPanel.port.on("doHighlight", function(docId) {
  console.log("doHighlight("+docId+")");
  var tab = tabs.activeTab;
  var worker = getWorker(tab);
  if( !worker ) {
    return;
  }
  var state = getState(tab);
  if( !state.lookupResults ) {
    return;
  }

  var doc = _.find(state.lookupResults.associations, function(d) { return d.elementId()==docId });
  if( !doc) {
    return;
  }

  // calculate fragments of text to highlight
  var txt = state.lookupResults.text;
  var frags = _.map(doc.leftFragments, function(f) {
    return txt.substr(f[0],f[1]);
  });

  state.currentlyHighlighted = docId;
//  var total =0;
//  _.each(frags, function(f) { console.log("'"+f+"': " + f.length); total += f.length; });
//  console.log(total);

  worker.port.emit("highlight",frags);

  /*
  var notification = require("notification-box").NotificationBox({
    'value': 'highlight-info',
    'label': 'Highlighting text from ' + doc.source(),
    'priority': 'INFO_LOW',
    'image': "",  //self.data.url("gnu-icon.png"),
  });
  */
});

ourPanel.port.on("noHighlight", function() {
  console.log("noHighlight");
  var tab = tabs.activeTab;
  var worker = getWorker(tab);
  if( !worker ) {
    return;
  }
  var state = getState(tab);
  if(state.currentlyHighlighted !== null) {
    state.currentlyHighlighted = null;
    worker.port.emit("unhighlight");
  }
});

// TODO: ditch pagemod altogether, use tab.attach() to inject content script!
// (on tab pageshow event?)
ourPanel.port.on("doLookup", function() {
  console.log("doLookup Requested!");
  var tab = tabs.activeTab;

  var worker = tab.attach({
    contentScriptFile: [data.url("logwrapper.js"),
        data.url("extractor.js"),
        data.url("jquery-1.7.1.min.js"),
        data.url("highlight.js"),
        /*
        data.url("rangy-core.js"),
        data.url("rangy-textselect.js"),
        data.url("rangy-cssclassapplier.js"),
        */
        data.url("gatso.js"),
        data.url("content.js")],
    contentStyleFile: [data.url("content.css")],
  });

  augmentTab(worker);
});

function installPageMod() {

  pageMod.PageMod({
    include: [ "http://*", "https://*" ],
    contentScriptWhen: 'start',
    attachTo: 'top',  // only attach to top, not iframes
    contentScriptFile: [data.url("logwrapper.js"),
        data.url("extractor.js"),
        data.url("jquery-1.7.1.min.js"),
        data.url("highlight.js"),
        /*
        data.url("rangy-core.js"),
        data.url("rangy-textselect.js"),
        data.url("rangy-cssclassapplier.js"),
        */
        data.url("gatso.js"),
        data.url("content.js")],
    contentStyleFile: [data.url("content.css")],
    onAttach: function(worker) {
      var url = worker.url;
      if( onWhitelist(url) ) {
        if( !onBlacklist(url) ) {
          augmentTab(worker);
        } else {
          console.log("backlisted: ", url);
        }
      } else {
          console.log("not on whitelist: ", url);
      }

    }
  });
}


// add our state-tracking stuff to a tab
function augmentTab(worker) {
  var tab=worker.tab;

  var url = tab.url;
  console.log("begin tracking tab: ", url);

  var state = new TabState(url, function (state) {update_gui();});

//  worker.tab.ourstate = state;

  tabmap[tab.id] = {'worker': worker, 'state': state};
  update_gui();

  // update our state when page text has been extracted...
  worker.port.on('textExtracted', function(pageDetails) {
    state.textReady(pageDetails);
  });
}




function installWidget() {
  return widget.Widget({
    id: "our-widget",
    label: " ",
    width: 20,
    contentURL: data.url("widget.html"),
    contentScriptFile: data.url("widget.js"),
    panel: ourPanel,
    tooltip: "Churnalism information",
  });
}

tabs.on('activate', function(tab) {
  update_gui();
});

tabs.on('close', function(tab){
  if(tab.id in tabmap) {
    delete tabmap[tab.id];
  }
});

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
//tabs.open(data.url("intro.html"));
console.log("startup done");
gatso.stop('startup');
gatso.report();



