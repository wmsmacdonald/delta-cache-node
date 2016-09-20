'use strict';
const http = require('http');
const url = require('url');

const createDeltaHistory = require('delta-history');

function createDeltaCache() {

  let deltaHistory = createDeltaHistory({});


  return function(req, res, responseBody, callback) {
    let resourcePath = url.parse(req.url).path;

    let id = deltaHistory.addVersion(resourcePath, new Buffer(responseBody));

    res.setHeader('ETag', `"${id}"`);

    let delta;
    let etag;
    if (req.headers['if-none-match'] !== undefined) {
      let etags = req.headers['if-none-match'].split(', ');
      // remove quotes from etag
      let etagsWithoutQuotes = etags.map(etag => etag.replace( /^"|"$/g, '' ));

      for (let i = 0; i < etagsWithoutQuotes.length; i++) {
        delta = deltaHistory.getDelta(resourcePath, etagsWithoutQuotes[i]);
        if (delta !== null) {
          etag = etagsWithoutQuotes[i];
          break;
        }
      }
    }

    // if etag wasn't in the header or there wasn't any matching etag
    if (delta === undefined || delta === null) {
      // send response with normal 200
      res.statusCode = 200;
      res.end(responseBody, undefined, callback);
    }
    // client has a cached version
    else {

      // has necessary headers for delta caching
      if (isDeltaCompatible(req.headers)) {
        // send delta
        res.setHeader('IM', 'vcdiff');
        res.setHeader('Delta-Base', `"${etag}"`);
        let status = 226;
        res.statusMessage = http.STATUS_CODES[status];
        res.statusCode = status;
        res.end(delta, 'binary');
      }
      else {
        // send response with normal 200
        res.statusCode = 200;
        res.end(responseBody, undefined, callback);
      }
    }
  }
}

function isDeltaCompatible(headers) {
  if (headers['a-im'] === undefined) {
    return false;
  }
  else {
    // checks header for delta compatibility
    return headers['a-im'].split(', ').indexOf('vcdiff') !== -1;
  }
}

module.exports = createDeltaCache;