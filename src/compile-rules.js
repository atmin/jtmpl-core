/**
 * Rules
 */
module.exports = {

  /* jshint evil:true */

  attr: [

    function(node, attr) {

    }
  ],

  node: [

    /**
     * {{var}}
     */
    function(node) {
      if (node.innerHTML.match(/^[\w\.\-]+$/)) {
        return {
          prop: node.innerHTML,
          rule: function(fragment, prop, model) {
            var textNode = document.createTextNode(model(prop) || '');
            fragment.appendChild(textNode);
            model.on('change', prop, function() {
              textNode.data = model(prop) || '';
            });
          }
        };
      }
    },


    /**
     * {{#section}}
     */
    function(node) {
      var match = node.innerHTML.match(/^#([\w\.\-])+$/);
      if (match) {
        return {
          block: match[1],
          rule: function(fragment, prop, model, template) {
            var section = document.createDocumentFragment();
            section.appendChild(eval(template + '(model)'));
            fragment.appendChild(section);
          }
        };
      }
    }

  ]
};
