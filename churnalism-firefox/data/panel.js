
// templates for showing the search results
var searchNoResultsTemplate = _.template($('#search-no-results-tmpl').html());
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


  if(results.associations.length > 0 ) {
    $('#content').html(searchResultsTemplate(results));

    // now format and insert each matching document
    var prList = $('.results-list');
    _.each( results.associations, function(doc) {
      doc.parent = results;
      prList.append(matchTemplate(doc));
    });
  } else {
    $('#content').html(searchNoResultsTemplate(results));
  }

  if(state.currentlyHighlighted == null) {
  } else {
    $("#"+state.currentlyHighlighted).addClass("is-highlighted");
  }

  $('.match-item').click(function() {
    $('.match-item').removeClass('is-highlighted');
    $(this).addClass('is-highlighted');
    self.port.emit('doHighlight',this.id);
  });

  $('.no-highlight').click(function() {
    $('.match-item').removeClass('is-highlighted');
    self.port.emit('noHighlight');
    return false;
  });
}


self.port.on("bind", bind);

