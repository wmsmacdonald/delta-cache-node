'use strict';

const http = require('http');
const fs = require('fs');
const url = require('url');
const util = require('util');

const assert = require('chai').assert;
const vcd = require('vcdiff');

const createDeltaCache = require('../');

const DEFAULT_REQUEST_OPTIONS = {
  host: 'localhost',
  port: 6767,
  path: '/'
};

describe('DeltaCache', function(){
  it("should handle response", function() {
    let deltaCache = createDeltaCache();
    let server = http.createServer((req, res) => {
      deltaCache.respondWithDeltaEncoding(req, res, 'some response', server.close().bind(server));
    });
  });

  describe("client request doesn't have A-IM header", function() {
    it("should get full response with etag", function (done) {
      let deltaCache = createDeltaCache();
      let text = 'some response';

      let server = http.createServer((res, req) => {
        deltaCache.respondWithDeltaEncoding(res, req, text);
      });

      server.listen(DEFAULT_REQUEST_OPTIONS.port, () => {
        GET(DEFAULT_REQUEST_OPTIONS).then(({ data, response }) => {
          assert.strictEqual(data.toString(), text);
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
    it("should get a 226 response with working delta for string", function(done) {
      let version1 = 'body 1';
      let version2 = 'body 2';

      let cache;
      simulateServerAndRequests([version1, version2], [(data, res) => {
        cache = data;
        // first response asserts
        assert.strictEqual(data.toString(), version1);
        assert.isDefined(res.headers['etag']);
        assert.isUndefined(res.headers['im']);

      }, (data, res) => {
        // second response asserts
        assert.isDefined(res.headers['etag']);
        assert.strictEqual(res.statusCode, 226);
        assert.strictEqual(res.statusMessage, 'IM Used');
        assert.strictEqual(res.headers['im'], 'vcdiff');
        let delta = new Buffer(data);
        let target = vcd.vcdiffDecodeSync(delta, { dictionary: new Buffer(cache) });
        // ensure the patched version is the same as the one on the server
        assert.strictEqual(target.toString(), version2);
      }]).then(done).catch(done);
    });
    it("should get a 226 response with working delta for buffer", function(done) {
      let version1 = new Buffer('body 1');
      let version2 = new Buffer('body 2');

      let cache;
      simulateServerAndRequests([version1, version2], [(data, res) => {
        cache = data;
        // first response asserts
        assert.strictEqual(data.toString(), version1.toString());
        assert.isDefined(res.headers['etag']);
        assert.isUndefined(res.headers['im']);

      }, (data, res) => {
        // second response asserts
        assert.isDefined(res.headers['etag']);
        assert.strictEqual(res.statusCode, 226);
        assert.strictEqual(res.statusMessage, 'IM Used');
        assert.strictEqual(res.headers['im'], 'vcdiff');
        let delta = new Buffer(data);
        let target = vcd.vcdiffDecodeSync(delta, { dictionary: new Buffer(cache) });
        // ensure the patched version is the same as the one on the server
        assert.strictEqual(target.toString(), version2.toString());
      }]).then(done).catch(done);
    });
    it("should get a 226 response with working delta with same fileId", function(done) {
      let version1 = new Buffer('body 1');
      let version2 = new Buffer('body 2');

      let cache;
      simulateServerAndRequests([version1, version2], [(data, res) => {
        cache = data;
        // first response asserts
        assert.strictEqual(data.toString(), version1.toString());
        assert.isDefined(res.headers['etag']);
        assert.isUndefined(res.headers['im']);

      }, (data, res) => {
        // second response asserts
        assert.isDefined(res.headers['etag']);
        assert.strictEqual(res.statusCode, 226);
        assert.strictEqual(res.statusMessage, 'IM Used');
        assert.strictEqual(res.headers['im'], 'vcdiff');
        let delta = new Buffer(data);
        let target = vcd.vcdiffDecodeSync(delta, { dictionary: new Buffer(cache) });
        // ensure the patched version is the same as the one on the server
        assert.strictEqual(target.toString(), version2.toString());
      }], ['id 1', 'id 1']).then(done).catch(done);
    });
    it("should get a 200 full response with different fileId", function(done) {
      let version1 = new Buffer('body 1');
      let version2 = new Buffer('body 2');

      let cache;
      simulateServerAndRequests([version1, version2], [(data, res) => {
        cache = data;
        // first response asserts
        assert.strictEqual(data.toString(), version1.toString());
        assert.isDefined(res.headers['etag']);
        assert.isUndefined(res.headers['im']);

      }, (data, res) => {
        assert.strictEqual(data.toString(), version2.toString());
        assert.isDefined(res.headers['etag']);
        assert.isUndefined(res.headers['im']);
      }], ['id 1', 'id 2']).then(done).catch(done);
    });
  });

  describe("client request has non-matching etag in If-None-Match header", function() {
    it("should get full response", function(done) {
      let deltaCache = createDeltaCache();
      let text = 'some response';
      let server = http.createServer((req, res) => {
        deltaCache.respondWithDeltaEncoding(req, res, text);
      });

      server.listen(DEFAULT_REQUEST_OPTIONS.port, () => {
        GET(util._extend(DEFAULT_REQUEST_OPTIONS, {
          headers: {
            'A-IM': 'vcdiff',
            'If-None-Match': '"unmatchable_etag"'
          }
        })).then(({ data, response }) => {
          assert.strictEqual(data.toString(), text);
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
 * Gets resource via http
 * @param options       options for http.request
 * @returns {Promise}
 * @constructor
 */
function GET(options) {
  return new Promise((resolve, reject) => {
    let req = http.get(options, (res) => {
      let data = [];
      res.on('data', (chunk) => {
        data.push(chunk);
      });
      res.on('end', () => {
        req.end();
        resolve({ data: Buffer.concat(data), response: res });
      });
    });
    req.on('error', reject);
  });
}

function simulateServerAndRequests(responseBodies, callbacks, fileIds) {
  fileIds = fileIds === undefined ? new Array(responseBodies.length) : fileIds

  let deltaCache = createDeltaCache();
  let responseNum = 0;
  let server = http.createServer((req, res) => {
    deltaCache.respondWithDeltaEncoding(req, res, responseBodies[responseNum],
      fileIds[responseNum++]);
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
 * @param requestOptions  http request options
 * @param etag  {string|undefined}  etag to include in If-Match-None header (only if defined)
 * @param callbacks {array} functions executed with params after request with params (data, response)
 * @returns {Promise}
 */
function simulateRequests(requestOptions, etag, callbacks) {
  return new Promise((resolve, reject) => {
    if (callbacks.length > 0) {
      request(requestOptions, etag).then(({ data, response }) => {
        callbacks[0](data, response);
        return simulateRequests(requestOptions, response.headers['etag'], callbacks.slice(1));
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
      'A-IM': 'vcdiff',
      'If-None-Match': etag
    };
  }
  return GET(options);
}