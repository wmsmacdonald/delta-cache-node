'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const url = require('url');
const util = require('util');

const assert = require('chai').assert;
const DiffMatchPatch = require('diff-match-patch');

const DeltaCache = require('../');

const diff = new DiffMatchPatch();

const EXPRESS_OPTIONS = {
  key: fs.readFileSync('./ssl/test_key.pem'),
  cert: fs.readFileSync('./ssl/test_cert.pem')
};

const DEFAULT_REQUEST_OPTIONS = {
  host: 'localhost',
  port: 6767,
  path: '/'
};

describe('DeltaCache', function(){
  it("should handle response", function() {
    let deltaCache = DeltaCache();
    let server = http.createServer((req, res) => {
      deltaCache(req, res, 'some response', undefined, server.close().bind(server));
    });
  });

  describe("client request doesn't have A-IM header", function() {
    it("should get full response with etag", function (done) {
      let deltaCache = DeltaCache();
      let text = 'some response';

      let server = http.createServer((res, req) => {
        deltaCache(res, req, text);
      });

      server.listen(DEFAULT_REQUEST_OPTIONS.port, () => {
        GET(DEFAULT_REQUEST_OPTIONS).then(({ data, response }) => {
          console.log('requested');
          assert.strictEqual(data, text);
          // etag should always be given
          assert.isDefined(response.headers['etag']);
          assert.strictEqual(response.statusCode, 200);
          assert.strictEqual(response.statusMessage, 'OK');
          server.close(done);
        }).catch(error => {
          done(error);
        });
      });
    });
  });

  describe("client request has matching etag in If-None-Match header and content has changed", function() {
    it("should get a 226 response with working delta", function(done) {
      let version1 = 'body 1';
      let version2 = 'body 2';

      let cache;
      simulateServerAndRequests([version1, version2], [(data, res) => {
        cache = data;
        // first response asserts
        assert.strictEqual(data, version1);
        assert.isDefined(res.headers['etag']);
        assert.isUndefined(res.headers['im']);

      }, (data, res) => {
        // second response asserts
        assert.isDefined(res.headers['etag']);
        assert.strictEqual(res.statusCode, 226);
        assert.strictEqual(res.statusMessage, 'IM Used');
        assert.strictEqual(res.headers['im'], 'googlediffjson');
        let patches = JSON.parse(data);
        let patchedVersion = diff.patch_apply(patches, cache)[0];
        // ensure the patched version is the same as the one on the server
        assert.strictEqual(patchedVersion, version2);
      }]).then(done).catch(done);
    });
  });
  describe("client request has matching etag in If-None-Match header and content hasn't changed", function() {
    it("should get a 304 response without a response body", function(done) {
      let text = 'some text';

      simulateServerAndRequests([text, text], [(data, res) => {

        assert.strictEqual(data, text);
        assert.isDefined(res.headers['etag']);
        assert.isUndefined(res.headers['im']);

      }, (data, res) => {
        assert.isDefined(res.headers['etag']);
        // status not changed
        assert.strictEqual(res.statusCode, 304);
        assert.strictEqual(res.statusMessage, 'Not Modified');
        // shouldnt' be any delta compression
        assert.isUndefined(res.headers['im']);
        // shouldn't have a response body
        assert.strictEqual(data, '');
      }]).then(done).catch(done);
    });
  });

  describe("client request has non-matching etag in If-None-Match header", function() {
    it("should get full response", function(done) {
      let deltaCache = DeltaCache();
      let text = 'some response';
      let server = http.createServer((req, res) => {
        deltaCache(req, res, text);
      });

      server.listen(DEFAULT_REQUEST_OPTIONS.port, () => {
        GET(util._extend(DEFAULT_REQUEST_OPTIONS, {
          headers: {
            'A-IM': 'googlediffjson',
            'If-None-Match': '"unmatchable_etag"'
          }
        })).then(({ data, response }) => {
          assert.strictEqual(data, text);
          assert.isDefined(response.headers['etag']);
          assert.isUndefined(response.headers['im']);
          assert.strictEqual(response.statusCode, 200);
          assert.strictEqual(response.statusMessage, 'OK');
          server.close(done);
        }).catch(error => {
          throw new Error(error);
        })
      });
    });
  });

});

/**
 * Gets resource via https
 * @param options       options for http.request
 * @returns {Promise}
 * @constructor
 */
function GET(options) {
  return new Promise((resolve, reject) => {
    let req = http.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        req.end();
        resolve({ data, response: res });
      });
    });
    req.on('error', reject);
  });
}

function simulateServerAndRequests(responseBodies, callbacks) {
  let deltaCache = DeltaCache();
  let responseNum = 0;
  let server = http.createServer((req, res) => {
    deltaCache(req, res, responseBodies[responseNum++]);
  });

  return new Promise((resolve, reject) => {
    server.listen(DEFAULT_REQUEST_OPTIONS.port, () => {

      simulateRequests(DEFAULT_REQUEST_OPTIONS, undefined, callbacks).then(() => {
        server.close(err => {
          if (err) {
            reject(err);
          }
          else {
            resolve();
          }
        });
      }).catch(reject);
    });
  })
}

/**
 * Recurisve method that keeps making requests (with etag if availible) as long as there are callbacks
 * @param requestOptions  https request options
 * @param etag  {string|undefined}  etag to include in If-Match-None header (only if defined)
 * @param callbacks {array} functions executed with params after request with params (data, response)
 * @returns {Promise}
 */
function simulateRequests(requestOptions, etag, callbacks) {
  return new Promise((resolve, reject) => {
    if (callbacks.length > 0) {
      request(requestOptions, etag).then(({ data, response }) => {
        callbacks[0](data, response);
        return simulateRequests(requestOptions, response.headers['etag'], callbacks.splice(1));
      }).then(resolve).catch(reject);
    }
    else {
      resolve();
    }
  });
}

/**
 * make a request, offering
 * @param requestOptions
 * @param etag
 * @returns {Promise}
 */
function request(requestOptions, etag) {
  let options = util._extend(requestOptions);
  if (etag !== undefined) {
    options.headers = {
      'A-IM': 'googlediffjson',
      'If-None-Match': etag
    };
  }
  return GET(options);
}