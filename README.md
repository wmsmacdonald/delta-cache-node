# delta-cache-express
Express middleware for server support for delta caching

Designed to work with [delta-cache-browser](https://github.com/wmsmacdonald/delta-cache-browser). Note that HTTPS is required if you're using that library.
 
Semi-complies with the [RFC 3229 delta encoding spec](https://tools.ietf.org/html/rfc3229#section-10.5.3) with [googlediffjson](https://code.google.com/p/google-diff-match-patch/wiki/API) encoded deltas.


### Getting Started
```javascript
var DeltaCache = require('delta-cache-express');
var express = require('express');

var deltaCache = DeltaCache();
var app = express();
app.get('/dynamicContent', function(req, res, next) {
  // put your response body in this variable for DeltaCache to find
  res.locals.responseBody = new Date().toString();
  next();
}, deltaCache);

```
