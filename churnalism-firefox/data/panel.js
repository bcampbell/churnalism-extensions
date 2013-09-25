
/*
Ashe.addModifiers({
    sourcelink: function(src) {
      if(src.title) { 
        return '<a target="_blank" href="' + src.url + '">' + src.title + '</a>';
      } else {
        var loc = parseUri(src.url);
        var title = {'pr':"Press release", 'paper': "Paper", 'other':"Other link"}[src.kind] || 'Source';
        return '<a target="_blank" href="' + src.url + '">' + title + '</a> (' + loc.host + ')';
      }
    }
    // , oneMoreModifier: function(str) { ... }
});
*/


function display(tmplName,params)
{
    var template = document.getElementById(tmplName).innerHTML;
    var parsed = Ashe.parse(template, params);
    document.getElementById('content').innerHTML = parsed;
}


/* firefox specifics */


function bind(state,options) {
//  console.log("popup.js: bind()", JSON.stringify(state,null," "));

  if( state === undefined ||state === null ) {
    display('popup-inactive-tmpl', {});
  } else {

    // TODO: HACK HACK HACK FIX FIX FIX
    // in firefox version, content page can't access functions on the state,
    // so we fudge it by re-adding them here!
    state.getSubmitURL = function() {
      var submit_url = options.search_server + '/addarticle?url=' + encodeURIComponent(this.url);
      return submit_url;
    };
    // some helpers for use in panel.html template (ashe can only do boolean if statements)
    state.isLookupNone = function() { return this.lookupState == 'none'; };
    state.isLookupReady = function() { return this.lookupState == 'ready'; };
    state.isLookupPending = function() { return this.lookupState == 'pending'; };
    state.isLookupError = function() { return this.lookupState == 'error'; };

    state.isDebugSet = function() { return options.debug; };
    state.getDebugTxt = function() { return JSON.stringify(this,null," "); };

    state.wasArticleFound = function() { return this.lookupState == 'ready' && this.lookupResults.status=='found'; };

    state.isSourcingRequired = function() {
      if( this.wasArticleFound() ) {
        return this.lookupResults.needs_sourcing;
      }
      
      if( this.pageDetails && !this.pageDetails.isDefinitelyNotArticle && this.pageDetails.indicatorsFound ) {
        return true;
      }
      return false;
    };


        display('popup-details-tmpl', state);

        // wire up any other javascript here (eg buttons)
        // (chrome extensions don't support any javascript in the html file,
        // so it's got to be done here
        /*
        var lookupButtons = document.querySelectorAll('.start-manual-lookup');
        for (var i = 0; i < lookupButtons.length; ++i) {
            lookupButtons[i].onclick = function() {
              self.port.emit("startManualLookup");
              return false;
            };
        }
        */
  }
}





self.port.on("bind", bind);

// TODO: start off in a better state... (haven't got options here)
//bind(null);

