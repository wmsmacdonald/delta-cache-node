'use strict';
const http = require('http');
const url = require('url');

const TextHistory = require('text-history');

function createDeltaCache() {

  let resourceHistories = {};

  return function(req, res, responseBody, callback) {
    let resourcePath = url.parse(req.url).path;

    // if there isn't a resource history yet
    if (resourceHistories[resourcePath] === undefined) {
      resourceHistories[resourcePath] = TextHistory();
    }
    let id = resourceHistories[resourcePath].addVersion(responseBody);

    res.setHeader('ETag', `"${id}"`);

    let matchingEtag = req.headers['if-none-match'] === undefined
      ? undefined
      : firstMatchingEtag(req.headers['if-none-match'], resourceHistories[resourcePath]);

    // if etag wasn't in the header or there wasn't any matching etag
    if (matchingEtag === undefined) {
      // send response with normal 200
      res.statusCode = 200;
      res.end(resourceHistories[resourcePath].lastVersion, undefined, callback);
    }
    // client has a cached version
    else {
      let patches = resourceHistories[resourcePath].getPatches(matchingEtag);

      // content hasn't changed
      if (patches.length === 0) {
        let status = 304;
        res.statusMessage = http.STATUS_CODES[status];
        res.statusCode = status;
        res.end();
      }
      // has necessary headers for delta caching
      else if (isDeltaCompatible(req.headers)) {
        // send delta
        res.setHeader('IM', 'googlediffjson');
        res.setHeader('Delta-Base', `"${matchingEtag}"`);
        let status = 226;
        res.statusMessage = http.STATUS_CODES[status];
        res.statusCode = status;
        res.end(JSON.stringify(patches));
      }
      else {
        // send response with normal 200
        res.statusCode = 200;
        res.end(resourceHistories[resourcePath].lastVersion, undefined, callback);
      }
    }
  }
}


function firstMatchingEtag(etagsHeader, resourceHistory) {
  let etags = etagsHeader.split(', ');
  // remove quotes from etag
  let etagsWithoutQuotes = etags.map(etag => etag.replace( /^"|"$/g, '' ));
  // gets etag that exists in the resource history
  return etagsWithoutQuotes.find(etag => resourceHistory.hasVersion(etag));
}

function isDeltaCompatible(headers) {
  if (headers['a-im'] === undefined) {
    return false;
  }
  else {
    // checks header for delta compatibility
    return headers['a-im'].split(', ').indexOf('googlediffjson') !== -1;
  }
}

module.exports = createDeltaCache;