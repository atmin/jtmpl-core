/*

### {{var}}

Can be bound to text node data or attribute

*/

    module.exports = function(tag, node, attr, model, options) {
      var react, target, change;

      function get() {
        var val = model(tag);
        return (typeof val === 'function') ?
          JSON.stringify(val.values) :
          val;
      }

      if (tag.match(require('../consts').RE_IDENTIFIER)) {

        if (attr) {
          // Attribute
          change = function() {
            var val = get();
            return val ?
              node.setAttribute(attr, val) :
              node.removeAttribute(attr);
          };
        }
        else {
          // Text node
          target = document.createTextNode('');
          change = function() {
            target.data = get() || '';
          };
        }

        // Match found
        return {
          prop: tag,
          replace: target,
          change: change
        };
      }
    }
