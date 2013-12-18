
var tmpl = {
  notTracking: document.getElementById("not-tracking-tmpl").innerHTML,
  pleaseWait: document.getElementById("please-wait-tmpl").innerHTML,
  matchesNotFound: document.getElementById("matches-not-found-tmpl").innerHTML,
  matchesFound: document.getElementById("matches-found-tmpl").innerHTML
};

function bind(state,options) {
  if( state === undefined ||state === null ) {
    $('#content').html(Mustache.render(tmpl.notTracking,{}));
    $('.do-lookup').click(function() {
      emit('doLookup');
    });
    return;
  }

  if( !state.pageDetails ) {
    $('#content').html(Mustache.render(tmpl.pleaseWait,{msg:"The page is still loading"}));
    return;
  }
 
  if( !state.lookupResults ) {
    $('#content').html(Mustache.render(tmpl.pleaseWait,{msg:"Checking with churnalism.com"}));
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
      emit('noHighlight');
    } else {
      $('.match-item').removeClass('is-highlighted');
      $(this).addClass('is-highlighted');
      emit('doHighlight',this.id);
    }
  });

}


/* start CHROME */

function emit(msg) {
  console.log(msg);
}

chrome.runtime.onMessage.addListener(function(req, sender, sendResponse) {
    // Do something
    //
    console.log("panel.js onMessage: ", req);
    switch(req.method) {
      case "bindPopup":
        bind( req.state, req.options);
        break;
    }
});

/* end CHROME */



