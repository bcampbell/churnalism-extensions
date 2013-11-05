

var template = _.template($('#search-results-tmpl').html());
var resultTemplate = _.template($('#resultTemplate').html());


function bind(state,options) {


//  console.log("popup.js: bind()", JSON.stringify(state,null," "));
  if( state === undefined ||state === null ) {
//    display('popup-inactive-tmpl', {});
    return;
  }
      
    if( !state.lookupResults ) {
//      display('popup-inactive-tmpl', {});
      return;
    }

    // bind on all the helper functions that didn't get passed through with the data
    var results = addHelpers(state.lookupResults);
    $('#content').html(template(results));

    var tbod = $('#content tbody');
    _.each( results.associations, function(doc) {
      doc.parent = results;
      tbod.append(resultTemplate(doc));
    });
}





self.port.on("bind", bind);

// TODO: start off in a better state... (haven't got options here)
//bind(null);

