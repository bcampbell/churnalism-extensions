# Browser extensions for churnalism.com (UK)

Browser extensions for Firefox and Chrome(/Chromium) to check news articles
against press releases in the [churnalism.com](http://churnalism.com) database.


## Shared files

A bunch of files are shared between the firefox and chrome versions.
Very often such files consist mainly of browser-neutral code with a couple
of browser-specific bits.

Rather than cobble up some clever code-generation system to keep things DRY,
I've just gone with having near-duplicate versions of the files for each
version. The browser-specific bits are denoted by comment markers.

The `sanity-check` script checks the shared files, and lets you know if 
there are any differences other than the comment marker lines.

example (from [content.js](churnalism-firefox/data/content.js)):

    function doHighlight(frags) { ... }
    function removeHighlight() { ... }
    function extract_article() { ... }

    ...

    /* start CHROME
    $( document ).ready( function() {
      var details = extract_article();
      chrome.runtime.sendMessage({'method': 'textExtracted', 'pageDetails': details});
    });

    chrome.runtime.onMessage.addListener(function(req, sender, sendResponse) {
        // Do something
        //
        switch( req.method) {
          case "highlight":
            doHighlight(req.frags);
            break;
          case "noHighlight":
            removeHighlight();
            break;
        }
    });
    end CHROME */

    /* start FIREFOX */
    $( document ).ready( function() {
      var details = extract_article();
      self.port.emit("textExtracted", pageDetails);
    });
    self.port.on('highlight', function(frags) { doHighlight(frags) });
    self.port.on('noHighlight', function() { removeHighlight() });
    /* end FIREFOX */

This example is from the firefox version - the chrome section is commented
out. The chrome version of the file should be identical, except that the
chrome section is enabled and the firefox one commented out.

Caveat: don't use `/* ... */` style comments within browser-specific blocks!

## Credits

Written by [Ben Campbell](http://scumways.com)

Initially based on my unsourced.org browser extension, which in turn pulled
bits from Sunlight's own churnalism extension.


