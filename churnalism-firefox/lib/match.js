if(_ === undefined) {
  var _ = require("underscore");
  _.str = require("underscore.string");
}

_.mixin(_.str.exports());





function cookDoc(response) {
    if (_.has(response,"id")){
      response["id"]=response.id.doctype+"/"+response.id.docid+"/";
    }
    if (_.has(response,'fragments')){
      left=_mergeFragments(response.fragments,0);
      right=_mergeFragments(response.fragments,1);
      _.extend(response,{
        leftFragments: left,
        rightFragments: right,
        leftCharacters: _.reduce(left,function(sum,val){return sum+val[1]},0),
        rightCharacters: _.reduce(right,function(sum,val){return sum+val[1]},0)
      });
    }
    return response;
}


function cookSearchResults(response) {
  response = cookDoc(response); // results is itself a doc
  if (_.has(response,"associations")){
    _.each(response["associations"],function(a){
      a = cookDoc(a);
    });
  }
  return response;
}


function _mergeFragments(fragments,pos) {
  sorted=_.sortBy(fragments,function(val){return val[pos]})
  merged=[[sorted[0][pos],sorted[0][2]]];
  _.each(sorted.slice(1),function(value){
    if ((_.last(merged)[0]+_.last(merged)[1])>=(value[pos]+value[2])){
      _.last(merged)[1]=value[pos]+value[2]-_.last(merged)[0]
    }else{
      merged.push([value[pos],value[2]])
    }
  })
  return merged;
}


// bind on some helper functions to the bare data
function addDocHelpers(results) {
  _.extend(results, {
    journalisted: function(){
      return "http://journalisted.com/article/"+Number(_.first(this.metaData.id)).toString(36)
    },
    journalists: function(){
      return _.join(",",this.metaData.journalists)
    },
    source: function(){
      return _.first(this.metaData.source)
    },
    published: function(){
      return moment(_.first(this.metaData.published)).format('Do MMMM YYYY')
    },
    score: function() {
      return Number((this.leftCharacters/this.parent.text.length+this.rightCharacters/this.characters)*1.5).toFixed(0);
    },
    cut: function(){
      return Number(this.leftCharacters/this.parent.text.length*100).toFixed(0);
    },
    paste: function() {
      return Number(this.rightCharacters/this.characters*100).toFixed(0);
    },
    overlap: function() {
      return this.leftCharacters;
    },
    shortTitle: function() {
      return _.prune(this.title,80);
    },
    permalink: function() {
      return _.first(this.metaData.permalink);
    },
  });
  return results;
}

function addHelpers(results) {
  results = addDocHelpers(results);
  if (_.has(results,"associations")) {
    _.each(results["associations"],function(a) {
      a = addDocHelpers(a);
    });
  }

  _.extend(results, {
    title: function(){
      count=this["associations"].length;
      return count+" "+_.humanize(this["name"])+((count>1)?"s":"");
    }
  });
  return results;
}

try {
    exports.cookSearchResults = cookSearchResults;
    exports.addHelpers = addHelpers;
} catch (e) {
    /* Ignore this. It just means we're in a content script, where CommonJS modules aren't supported. */
}

