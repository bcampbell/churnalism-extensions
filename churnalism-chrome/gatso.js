var Gatso = function() {
  var gatsoTimers = {};

  return {
    start: function(name) {
      if( name in gatsoTimers ) {
        gatsoTimers[name].start = (new Date()).getTime();
      } else {
        gatsoTimers[name] = { start: (new Date()).getTime(), elapsed: 0, cnt: 0 };
      }
    },

    stop: function(name) {
      var t = (new Date()).getTime();
      var gat = gatsoTimers[name];
      gat.elapsed += t-gat.start;
      gat.cnt += 1;
    },


    report: function() {
      console.log("----gatsos----")
        for (var name in gatsoTimers) {
          var gat = gatsoTimers[name];
          var s = name + ": " + gat.elapsed +"ms (" + gat.cnt + " calls)";
          console.log(s)
        }
      console.log("--------------")

        gatsoTimers = {};
    }
  };
}();

try {
  exports.start = Gatso.start;
  exports.stop = Gatso.stop;
  exports.report = Gatso.report;
} catch (e) {
  /* Ignore this. It just means we're in a content script, where CommonJS modules aren't supported. */
}


