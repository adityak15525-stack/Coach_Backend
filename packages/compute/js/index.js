'use strict';
// Loader: prefer the native C++ build (native engine, sub-50ms), else JS fallback.
let native = null;
try {
  native = require('../build/Release/compute.node');
  native.engine = 'native-cpp';
} catch {
  native = null;
}

const fallback = require('./fallback.js');

module.exports = native || fallback;
