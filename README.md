# delta-cache-node
Node server-side support for delta caching
 
Complies with the [RFC 3229 delta encoding spec](https://tools.ietf.org/html/rfc3229#section-10.5.3) with [googlediffjson](https://code.google.com/p/google-diff-match-patch/wiki/API) encoded deltas, so it works with [delta-cache-browser](https://github.com/wmsmacdonald/delta-cache-browser).


### Getting Started
```javascript
var createDeltaCache = require('delta-cache');

var deltaCache = createDeltaCache();
var server = http.createServer((req, res) => {
  deltaCache(req, res, 'sample dynamic response ' + new Date().toString());
});
```
## API

### `createDeltaCache()`
Returns a `DeltaCache` instance.

## Class: `DeltaCache`
This class internally contains file versions that are saved to disk.

### deltaCache.respondWithDeltaEncoding(req, res, data[, fileId][, callback])
* `req` [http.IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
* `res` [http.ServerMessage](https://nodejs.org/api/http.html#http_class_http_serverresponse)
* `data` String | Buffer
* `fileId` String = require('url').parse(req.url).path
* `callback` Function()

Sends a response with `data` to the client, using delta encoding if possible. If `fileId` is not given, it defaults to the [path](https://nodejs.org/api/url.html#url_urlobject_path) of the request URL. The parameter `fileId` identifies the file in the server version history, so a second request to the same `fileId` will give a delta encoded response (provided the client cached the first).

All versions of data are stored in disk in the filesystem as temporary files, and will be deleted when the Node process exits. To see the implementation of the version cache, see [delta-history](https://github.com/wmsmacdonald/delta-history). 
