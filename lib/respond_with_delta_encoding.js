'use strict'

const http = require('http');
const url = require('url');

/**
 *
 * @param deltaHistory DeltaHistory
 * @param req http.IncomingMessage
 * @param res http.ServerMessage
 * @param data String | Buffer
 * @param optional1
 * @param optional2
 */
function respondWithDeltaEncoding(deltaHistory, req, res, data, optional1, optional2) {
  let fileId
  let callback

  // infer that optional1 is the callback
  if (typeof optional1 === 'function' && optional2 === undefined) {
    callback = optional1
  }
  else {
    fileId = optional1
    callback = optional2
  }

  fileId = fileId === undefined ? url.parse(req.url).path : fileId

  const cachedEtags = (req.headers['if-none-match'] === undefined ||
    !deltaHistory.hasFile(fileId)) ?
      [] : req.headers['if-none-match'].split(', ')
      .map(etag => etag.replace( /^"|"$/g, '' ))
      // only etags in cache
      .filter(
        etag => deltaHistory.hasVersion(fileId, etag)
      )

  let id = deltaHistory.addVersion(fileId, data);
  res.setHeader('ETag', `"${id}"`);

  // if etag wasn't in the header or there wasn't any matching etag
  if (cachedEtags.length === 0 || !isDeltaCompatible(req.headers)) {
    // send response with normal 200
    res.statusCode = 200;
    res.end(data, 'binary', callback);
  }
  // client has a cached version
  else {
    const selectedEtag = cachedEtags[0]
    const delta = deltaHistory.getDelta(fileId, selectedEtag)
    // send delta
    res.setHeader('IM', 'vcdiff');
    res.setHeader('Delta-Base', `"${selectedEtag}"`);
    res.statusMessage = http.STATUS_CODES[226];
    res.statusCode = 226;
    res.end(delta, 'binary', callback);
  }
}


/**
 * if delta caching is available
 * @param headers
 * @returns {boolean}
 */
function isDeltaCompatible(headers) {
  return headers['a-im'] !== undefined &&
    // vcdiff in A-IM header
    headers['a-im'].split(', ').indexOf('vcdiff') !== -1;
}

module.exports = respondWithDeltaEncoding
