'use strict';
// Metro 0.82 calls the image-size 1.x API: require('image-size')(bufferOrPath[, callback]).
// image-size 2.x (advisory fixes GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq, GHSA-m5qc-5hw7-8vg7) exports
// { imageSize } and accepts bytes only, so this adapter reads paths and delegates to the patched 2.x.
const {readFileSync}=require('node:fs');
const {imageSize,disableTypes,types}=require('image-size-v2');

function sizeOf(input,callback){
  const run=()=>imageSize(typeof input==='string'?readFileSync(input):input);
  if(typeof callback!=='function')return run();
  let result;
  try{result=run()}catch(error){return callback(error)}
  callback(null,result);
}

module.exports=sizeOf;
module.exports.default=sizeOf;
module.exports.imageSize=sizeOf;
module.exports.disableTypes=disableTypes;
module.exports.types=types;
