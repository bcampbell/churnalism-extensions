// needle: regex to search for
// rootNode: the starting point (default: document.body)
function findText(needle, rootNode) {

  if (rootNode===undefined) {
    rootNode = document.body;
  }
  // collect up all the text into a single big string
  // iterate through textnodes only, but not inside <script> or <style>
  var textNodeIt = document.createNodeIterator(
      rootNode,
      NodeFilter.SHOW_TEXT,
      function(node) {
        if ( /(script|style)/i.test(node.parentElement.tagName)) {
          return  NodeFilter.FILTER_REJECT;
        } else {
          return NodeFilter.FILTER_ACCEPT;
        }
      });

  // keep track of how the nodes map to the haystack
  lookup = [];

  var haystack = "";
  var pos=0;
  while( n = textNodeIt.nextNode() )
  {
    lookup.push({node: n, begin: pos, end: pos+n.data.length});
    haystack = haystack + n.data;
    pos += n.data.length;
  }

  // search it!
  var found = [];
  var m;
  while ((m = needle.exec(haystack)) !== null)
  {
    // convert to a Range
    var r = document.createRange();
    // set start of range
    for ( var i=0; i<lookup.length; ++i ) {
      var foo=lookup[i];
      if ( m.index >=foo.begin && m.index <foo.end ) {
        r.setStart(foo.node,m.index-foo.begin);
        break;
      }
    }
    // set end of range
    var mEnd = m.index + m[0].length;
    for ( var i=0; i<lookup.length; ++i ) {
      var foo=lookup[i];
      if ( mEnd >foo.begin && mEnd <=foo.end ) {
        r.setEnd(foo.node,mEnd-foo.begin);
        break;
      }
    }

    found.push(r);

    // if the regex doesn't have the global flag set, stop now!
    if (!needle.global) {
      break;
    }
  }

  return found;
}



function rangeIntersectsNode(range, node) {
    var nodeRange;
    if (range.intersectsNode) {
        return range.intersectsNode(node);
    } else {
        nodeRange = node.ownerDocument.createRange();
        try {
            nodeRange.selectNode(node);
        } catch (e) {
            nodeRange.selectNodeContents(node);
        }

        return range.compareBoundaryPoints(Range.END_TO_START, nodeRange) == -1 &&
            range.compareBoundaryPoints(Range.START_TO_END, nodeRange) == 1;
    }
}

// wraps a range with <span class="cls">
function highlightRange(r,cls) {
  // iterate through each text node that intersects the range
  var it = document.createNodeIterator(
      r.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      function(node) {
        if ( /(script|style)/i.test(node.parentElement.tagName)) {
          return  NodeFilter.FILTER_REJECT;
        } else {

          if (!rangeIntersectsNode(r,node)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });

  var nodesToWrap = []
  var n;
  while(n=it.nextNode()) {
    nodesToWrap.push(n);
  }

  nodesToWrap.forEach(function(n) {

    before = null;
    mid = n;
    after = null;

    // order is important here - if we snip the beginning off first, the offsets will all change!
    if (n==r.endContainer && r.endOffset<n.data.length) {
      after = mid.splitText(r.endOffset);
    }
    if (n==r.startContainer && r.startOffset > 0) {
      before = mid;
      mid = before.splitText(r.startOffset);
    }

    var spannode = document.createElement('span');
    spannode.className = cls;

    var c = mid.cloneNode(true);
    spannode.appendChild(c);
    mid.parentNode.replaceChild(spannode,mid);
  });
}

// wraps <span class="cls">...</span> around each given range
// assumes ranges are in sequence and don't overlap
function highlightRanges(ranges, cls) {
  // in reverse order to avoid screwing up offsets...
  for ( var i=ranges.length-1;i>=0; --i ) {
    var range = ranges[i];
    highlightRange(range, cls);
  }
}

