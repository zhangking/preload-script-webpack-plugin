preload-script-webpack-plugin
=============

fork from https://github.com/GoogleChrome/preload-webpack-plugin

#### different

It won't insert html template, replaced by inserting the target chunk file.

```
plugins = [new PreloadWebpackPlugin({
    insertChunk: 'vendor' 
}]
```