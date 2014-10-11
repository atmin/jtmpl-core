/*

### selected="{{val}}"

Handle "selected" attribute

*/

    var selects = [];
    var selectOptions = [];
    var selectOptionsContexts = [];

    function updateOptions(i, prop) {
      for (var oi = 0, olen = selectOptions[i].length; oi < olen; oi++) {
        selectOptionsContexts[i][oi](prop, selectOptions[i][oi].selected);
      }
    }

    module.exports = function(tag, node, attr, model, options) {
      var match = tag.match(require('../consts').RE_IDENTIFIER);
      var prop = match && match[0];

      function change() {
        node[model(prop) ? 'setAttribute' : 'removeAttribute']
          ('selected', '');
      }

      if (match && attr === 'selected') {
        // <select> option?
        if (node.nodeName === 'OPTION') {
          // Process async, as parentNode is still documentFragment
          setTimeout(function() {
            var i = selects.indexOf(node.parentNode);
            if (i === -1) {
              // Add <select> to list
              i = selects.push(node.parentNode) - 1;
              // Init options
              selectOptions.push([]);
              // Init options contexts
              selectOptionsContexts.push([]);
              // Attach change listener
              node.parentNode.addEventListener('change', function() {
                updateOptions(i, prop);
              });
            }
            // Remember option and context
            selectOptions[i].push(node);
            selectOptionsContexts[i].push(model);
          }, 0);
        }

        return {
          prop: prop,
          replace: '',
          change: change,
          asyncInit: function() {
            model.trigger('change', prop);
          }
        };
      }
    }
