/**
 * Rules
 */
module.exports = {

  attr: [

    function(node, attr) {

    }
  ],

  node: [

    /**
     * {{var}}
     */
    function(node) {
      if (node.innerHTML.match(/[\w\.\-]+/)) {
        return {
          rule: function(fragment, node, model) {
            var prop = node.innerHTML;
            var textNode = document.createTextNode(model(prop));
            model.on('change', prop, function() {
              textNode.data = model(prop);
            });
            fragment.appendChild(textNode);
          }
        };
      }
    }

  ]
};
