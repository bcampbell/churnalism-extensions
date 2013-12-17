var params = {
  'associations' : [
    {'title':'Article One',permalink:'http://example.com/foo'},
    {'title':'Article Two',permalink:'http://example.com/foo_too'}
  ],
  'assocs_txt' : function() { console.log(this); return this.associations.length==1 ? 'match':'matches'; }
}



var foo = Mustache.render($('#search-results-tmpl').html(),params);
$('#content').html(foo);




