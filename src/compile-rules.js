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

            // Anchor node for keeping section location
            var anchor = document.createComment('');
            // Number of rendered nodes
            var length = 0;
            // How many childNodes in one section item
            var chunkSize;

            function update(i) {
              return function() {
                var parent = anchor.parentNode;
                var anchorIndex = [].indexOf.call(parent.childNodes, anchor);
                var pos = anchorIndex - length + i * chunkSize;

                parent.replaceChild(
                  eval(template + '(model(prop)(i))'),
                  parent.childNodes[pos]
                );
              };
            }

            function insert(index, count) {
              var parent = anchor.parentNode;
              var anchorIndex = [].indexOf.call(parent.childNodes, anchor);
              var pos = anchorIndex - length + index * chunkSize;
              var size = count * chunkSize;
              var i, fragment;

              for (i = 0, fragment = document.createDocumentFragment();
                  i < count; i++) {
                fragment.appendChild(eval(template + '(model(prop)(index + i))'));
              }

              parent.insertBefore(fragment, parent.childNodes[pos]);
              length = length + size;
            }

            function del(index, count) {
              var parent = anchor.parentNode;
              var anchorIndex = [].indexOf.call(parent.childNodes, anchor);
              var pos = anchorIndex - length + index * chunkSize;
              var size = count * chunkSize;

              length = length - size;

              while (size--) {
                parent.removeChild(parent.childNodes[pos]);
              }
            }

            function change() {
              var val = prop === '.' ? model : model(prop);
              var i, len, render;

              // Delete old rendering
              while (length) {
                anchor.parentNode.removeChild(anchor.previousSibling);
                length--;
              }

              // Array?
              if (typeof val === 'function' && val.len !== undefined) {
                val.on('insert', insert);
                val.on('delete', del);
                render = document.createDocumentFragment();

                for (i = 0, len = val.len; i < len; i++) {
                  val.on('change', i, update(i));
                  render.appendChild(eval(template + '(val(i))'));
                }

                length = render.childNodes.length;
                chunkSize = ~~(length / len);
                anchor.parentNode.insertBefore(render, anchor);
              }

              // Object?
              else if (typeof val === 'function' && val.len === undefined) {
                render = eval(template + '(val)');
                length = render.childNodes.length;
                chunkSize = length;
                anchor.parentNode.insertBefore(render, anchor);
              }

              // Cast to boolean
              else {
                if (!!val) {
                  render = eval(template + '(model)');
                  length = render.childNodes.length;
                  chunkSize = length;
                  anchor.parentNode.insertBefore(render, anchor);
                }
              }
            }

            fragment.appendChild(anchor);
            model.on('change', prop, change);
            change();
          }
        };
      }
    }

  ]
};
