'use strict'

const http = require('http');
const url = require('url');

function respondWithDeltaEncoding(deltaHistory, req, res, responseBody, callback) {
  let resourcePath = url.parse(req.url).path;

  let id = deltaHistory.addVersion(resourcePath, new Buffer(responseBody));

  res.setHeader('ETag', `"${id}"`);

  const cachedEtags = req.headers['if-none-match'] === undefined ?
    [] : req.headers['if-none-match'].split(', ')
          .map(etag => etag.replace( /^"|"$/g, '' ))
          // only etags in cache
          .filter(
            etag => deltaHistory.hasVersion(resourcePath, etag)
          )


  // if etag wasn't in the header or there wasn't any matching etag
  if (cachedEtags.length === 0 || !isDeltaCompatible(req.headers)) {
    // send response with normal 200
    res.statusCode = 200;
    res.end(responseBody, undefined, callback);
  }
  // client has a cached version
  else {
    const delta = deltaHistory.getDelta(resourcePath, cachedEtags[0])
    // send delta
    res.setHeader('IM', 'vcdiff');
    res.setHeader('Delta-Base', `"${cachedEtags[0]}"`);
    res.statusMessage = http.STATUS_CODES[226];
    res.statusCode = 226;
    res.end(delta, 'binary');
  }
}

function isDeltaCompatible(headers) {
  return headers['a-im'] !== undefined &&
    // vcdiff in A-IM header
    headers['a-im'].split(', ').indexOf('vcdiff') !== -1;
}

module.exports = respondWithDeltaEncoding
