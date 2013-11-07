
// templates for showing the search results
var searchResultsTemplate = _.template($('#search-results-tmpl').html());
var matchTemplate = _.template($('#match-tmpl').html());

// to display when page not on whitelist
var notTrackingTemplate = _.template($('#not-tracking-tmpl').html());

// to display when waiting (for page to load or search req to return)
var pleaseWaitTemplate = _.template($('#please-wait-tmpl').html());

function bind(state,options) {

//  console.log("popup.js: bind()", JSON.stringify(state,null," "));
  if( state === undefined ||state === null ) {
    $('#content').html(notTrackingTemplate());
    // TODO: bind in link to kick off search
    $('.do-lookup').click(function() {
      self.port.emit('doLookup');
    });
    return;
  }

  if( !state.pageDetails ) {
    $('#content').html(pleaseWaitTemplate({msg:"The page is still loading"}));
    return;
  }
      
  if( !state.lookupResults ) {
    $('#content').html(pleaseWaitTemplate({msg:"Checking with churnalism.com"}));
    return;
  }

  // bind on all the helper functions that didn't get passed through with the data
  var results = addHelpers(state.lookupResults);
  $('#content').html(searchResultsTemplate(results));

  var tbod = $('#content tbody');
  // now format and insert each matching document
  _.each( results.associations, function(doc) {
    doc.parent = results;
    tbod.append(matchTemplate(doc));
  });
}


self.port.on("bind", bind);


