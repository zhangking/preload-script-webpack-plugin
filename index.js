'use strict';

const objectAssign = require('object-assign');

const flatten = arr => arr.reduce((prev, curr) => prev.concat(curr), []);

const defaultOptions = {
  rel: 'preload',
  include: 'asyncChunks',
  fileBlacklist: [/\.map/],
  delay: 0
};

class PreloadPlugin {
  constructor(options) {
    this.options = objectAssign({}, defaultOptions, options);
  }

  apply(compiler) {
    const options = this.options;
    let filesToInclude = [];
    let extractedChunks = [];
    let insertFunction;
    let createLinkFunction = `
      var createLink = function(params){
        var link = document.createElement('link');
        link.rel = params.rel;
        link.as = params.as;
        link.href = params.href;
        params.crossorigin && (link.crossorigin = 'crossorigin');
        document.head.appendChild(link);
      }
    `;
    let linkParams = [];
    compiler.plugin('compilation', compilation => {
      compilation.plugin('html-webpack-plugin-before-html-processing', (htmlPluginData, cb) => {
        if (options.include === undefined || options.include === 'asyncChunks') {
          try {
            extractedChunks = compilation.chunks.filter(chunk => !chunk.isInitial());
          } catch (e) {
            extractedChunks = compilation.chunks;
          }
        } else if (options.include === 'all') {
            // Async chunks, vendor chunks, normal chunks.
          extractedChunks = compilation.chunks;
        } else if (Array.isArray(options.include)) {
          // Keep only user specified chunks
          extractedChunks = compilation
              .chunks
              .filter((chunk) => {
                const chunkName = chunk.name;
                // Works only for named chunks
                if (!chunkName) {
                  return false;
                }
                return options.include.indexOf(chunkName) > -1;
              });
        }

        const publicPath = compilation.outputOptions.publicPath || '';

        flatten(extractedChunks.map(chunk => chunk.files)).filter(entry => {
          return this.options.fileBlacklist.every(regex => regex.test(entry) === false);
        }).forEach(entry => {
          entry = `${publicPath}${entry}`;
          if (options.rel === 'preload') {
            let asValue;
            if (!options.as) {
              if (entry.match(/\.css$/)) asValue = 'style';
              else if (entry.match(/\.woff2$/)) asValue = 'font';
              else asValue = 'script';
            } else if (typeof options.as === 'function') {
              asValue = options.as(entry);
            } else {
              asValue = options.as;
            }
            const crossOrigin = asValue === 'font';
            linkParams.push({
              rel: options.rel,
              as: asValue,
              crossOrigin: crossOrigin,
              href: entry
            });
          } else {
            linkParams.push({
              rel: options.rel,
              href: entry
            });
          }
        });
        insertFunction = `
          (function() {
            var params = ${JSON.stringify(linkParams)};
            ${createLinkFunction}
            setTimeout(function(){
              for(var i in params){
                createLink(params[i]);
              }
            },${options.delay});
          })()
        `;
        const targetChunkFile = compilation.chunks.find((i) => {return i.name == options.insertChunk;})
        if (targetChunkFile) {
          const chunkFile = targetChunkFile.files[0];
          const targetAssets = compilation.assets[chunkFile];
          if (targetAssets) {
            const source = targetAssets.source();
            targetAssets.source = () => {
                return source + insertFunction;
            }
          }
        }
        cb(null, htmlPluginData);
      });
    });
  }
}

module.exports = PreloadPlugin;
