/*

### (value | checked | selected)="{{val}}"

Handle "value", "checked" and "selected" attributes

*/

    module.exports = function(tag, node, attr, model, options) {
      var match = tag.match(require('../consts').RE_IDENTIFIER);
      var prop = match && match[0];

      function change() {
        var val = model(prop);
        if (node[attr] !== val) {
          node[attr] = val;
        }
      }
      
      if (match && ['value', 'checked', 'selected'].indexOf(attr) > -1) {
        model.on('change', prop, change);
        change();

        // <select> option?
        if (node.nodeName === 'OPTION') {
          // Attach async, as parentNode is still documentFragment
          setTimeout(function() {
            node.parentNode.addEventListener('change', function() {
              if (model(prop) !== node.selected) {
                model(prop, node.selected);
              }
            });
          }, 0);
        }

        // radio group?
        if (node.type === 'radio' && node.name) {
          node.addEventListener('change', function() {
            if (node[attr]) {
              for (var i = 0, 
                  inputs = document.querySelectorAll('input[type=radio][name=' + node.name + ']'),
                  len = inputs.length;
                  i < len;
                  i++
                ) {
                if (inputs[i] !== node) {
                  inputs[i].dispatchEvent(new Event('change'));
                }
              }
            }
            model(prop, node[attr]);
          });
        }

        // text input?
        var eventType = ['text', 'password'].indexOf(node.type) > -1 ?
          'input' : 'change';

        node.addEventListener(eventType, function() {
          model(prop, node[attr]);
        });

        return {
          replace: '' 
        };
      }
    }