/*

Evaluate object from literal or CommonJS module

*/

  	/* jshint evil:true */
    module.exports = function(target, src, model) {

      var consts = require('./consts');

      model = model || {};
      if (typeof model !== 'function') {
        model = jtmpl.freak(model);
      }

      function mixin(target, properties) {
        for (var prop in properties) {
          if (prop.indexOf('__') === 0 &&
              prop.lastIndexOf('__') === prop.length - 2) {
            if (target.values[prop] === undefined) {
              target.values[prop] = properties[prop];
            }
          }
          else {
            // Target doesn't already have prop?
            if (target(prop) === undefined) {
              target(prop, properties[prop]);
            }
          }
        }
      }

      function applyPlugins() {
        var prop, arg;
        for (prop in jtmpl.plugins) {
          plugin = jtmpl.plugins[prop];
          arg = model.values['__' + prop + '__'];
          if (typeof plugin === 'function' && arg !== undefined) {
            plugin.call(model, arg);
          }
        }
      }

      function evalObject(body) {
        var result, module = { exports: {} };
        return (body.match(/^\s*{[\S\s]*}\s*$/)) ?
          // Literal
          eval('result=' + body) :
          // CommonJS module
          new Function('module', 'exports', body + ';return module.exports;')
            (module, module.exports);
      }

      function loadModel(src, template, doc) {
        if (!src) {
          // No source
          jtmpl(target, template, model);
        }
        else if (src.match(consts.RE_NODE_ID)) {
          // Element in this document
          var element = doc.querySelector(src);
          mixin(model, evalObject(element.innerHTML));
          applyPlugins();
          jtmpl(target, template, model);
        }
        else {
          // Get model via XHR
          jtmpl('GET', src, function (resp) {
            var match = src.match(consts.RE_ENDS_WITH_NODE_ID);
            var element = match && new DOMParser()
              .parseFromString(resp, 'text/html')
              .querySelector(match[1]);
            mixin(model, evalObject(match ? element.innerHTML : resp));
            applyPlugins();
            jtmpl(target, template, model);
          });
        }
      }

      function loadTemplate() {
        if (src.match(consts.RE_NODE_ID)) {
          // Template is the contents of element
          // belonging to this document
          var element = document.querySelector(src);
          loadModel(element.getAttribute('data-model'), element.innerHTML, document);
        }
        else {
          // Get template via XHR
          jtmpl('GET', src, function(resp) {
            var match = src.match(consts.RE_ENDS_WITH_NODE_ID);
            var doc = match ? new DOMParser().parseFromString(resp, 'text/html') : document;
            var element = match && doc.querySelector(match[1]);

            loadModel(
              match ? element.getAttribute('data-model') : '',
              match ? element.innerHTML : resp,
              doc
            );
          });
        }
      }

      loadTemplate();
    };
