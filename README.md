# delta-cache-node
Node server-side support for delta caching
 
Complies with the [RFC 3229 delta encoding spec](https://tools.ietf.org/html/rfc3229#section-10.5.3) with [googlediffjson](https://code.google.com/p/google-diff-match-patch/wiki/API) encoded deltas, so it works with [delta-cache-browser](https://github.com/wmsmacdonald/delta-cache-browser).


### Getting Started
```javascript
var DeltaCache = require('delta-cache');

var deltaCache = createDeltaCache();
var server = http.createServer((req, res) => {
  deltaCache(req, res, 'sample dynamic response ' + new Date().toString());
});

```
## createDeltaCache()
Returns a `deltaCache` function corresponding to a delta cache instance.

## deltaCache(req, res, responseBody, [callback])
* `req` [http.IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
* `res` [http.ServerMessage](https://nodejs.org/api/http.html#http_class_http_serverresponse)
* `responseBody` String 
* `callback` Function

Function uses the responseBody to send a response to the client with delta encoding if possible. It caches by resource path, so a second request to `/examplePath` will delta encoding (provided the client cached the first).

The cache is in memory.
