/*

Evaluate object from literal or CommonJS module

*/

  	/* jshint evil:true */
    module.exports = function(target, src, obj) {

      var consts = require('./consts');

      obj = obj || {};

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
          jtmpl(target, template, obj);
        }
        else if (src.match(consts.RE_NODE_ID)) {
          // Element in this document
          var element = doc.querySelector(src);
          jtmpl(target, template, evalObject(element.innerHTML));
        }
        else {
          // Get model via XHR
          jtmpl('GET', src, function (resp) {
            var match = src.match(consts.RE_ENDS_WITH_NODE_ID);
            var element = match && new DOMParser()
              .parseFromString(resp, 'text/html')
              .querySelector(match[1]);

            jtmpl(
              target,
              template,
              require('object-extend')(
                match ? evalObject(element.innerHTML) : {},
                obj
              )
            );
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
