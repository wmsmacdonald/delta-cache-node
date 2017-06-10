'use strict';

const createDeltaHistory = require('delta-history');

const respondWithDeltaEncoding = require('./respond_with_delta_encoding')

function createDeltaCache() {

  let deltaHistory = createDeltaHistory();

  return {
    respondWithDeltaEncoding: respondWithDeltaEncoding.bind(null, deltaHistory)
  }
}




module.exports = createDeltaCache;