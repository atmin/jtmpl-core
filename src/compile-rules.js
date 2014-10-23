// TODO: REFACTORME

jtmpl.get = function(model, prop) {
  var val = model(prop);
  return (typeof val === 'function') ?
    JSON.stringify(val.values) :
    val;
};


var RE_DELIMITED_VAR = /^\{\{([\w\.\-]+)\}\}$/;


/**
 * Rules
 */
module.exports = {

  /* jshint evil:true */



  attr: [


    /**
     * value="{{var}}"
     */
    function(node, attr) {
      var match = node.getAttribute(attr).match(RE_DELIMITED_VAR);
      if (attr === 'value' && match) {

        return {

          prop: match[1],

          rule: function(node, attr, model, prop) {

            function change() {
              var val = jtmpl.get(model, prop);
              if (node[attr] !== val) {
                node[attr] = val || '';
              }
            }

            // text input?
            var eventType = ['text', 'password'].indexOf(node.type) > -1 ?
              'keyup' : 'change'; // IE9 incorectly reports it supports input event

            node.addEventListener(eventType, function() {
              model(prop, node[attr]);
            });

            model.on('change', prop, change);
            change();

          }
        };
      }
    },




    /**
     * selected="{{var}}"
     */
    function(node, attr) {
      var match = node.getAttribute(attr).match(RE_DELIMITED_VAR);
      if (attr === 'selected' && match) {

        return {

          prop: match[1],

          rule: function(node, attr, model, prop) {

            var selects = [];
            var selectOptions = [];
            var selectOptionsContexts = [];
            // Currently updating? Initialized to true to avoid sync init
            var updating = true;

            function change() {
              if (updating) {
                return;
              }
              if (node.nodeName === 'OPTION') {
                var i = selects.indexOf(node.parentNode);
                for (var j = 0, len = selectOptions[i].length; j < len; j++) {
                  selectOptions[i][j].selected = selectOptionsContexts[i][j](prop);
                }
              }
              else {
                node.selected = model(prop);
              }
            }

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
                    updating = true;
                    for (var oi = 0, olen = selectOptions[i].length; oi < olen; oi++) {
                      selectOptionsContexts[i][oi](prop, selectOptions[i][oi].selected);
                    }
                    updating = false;
                  });
                }
                // Remember option and context
                selectOptions[i].push(node);
                selectOptionsContexts[i].push(model);
              }, 0);

            }
            else {
              node.addEventListener('change', function() {
                model(prop, this.selected);
              });
            }


            model.on('change', prop, change);
            setTimeout(function() {
              updating = false;
              model.trigger('change', prop);
            });
          }
        };
      }
    },




    /**
     * checked="{{var}}"
     */
    function(node, attr) {

    },




    /**
     * class="{{var}}"
     */
    function(node, attr) {

    },




    /**
     * style="{{var}}"
     */
    function(node, attr) {

    },




    /**
     * attribute="{{var}}"
     */
    function(node, attr) {
      var match = node.getAttribute(attr).match(RE_DELIMITED_VAR);
      if (match) {

        return {

          prop: match[1],

          rule: function(node, attr, model, prop) {

            function change() {
              var val = jtmpl.get(model, prop);
              return val ?
                node.setAttribute(attr, val) :
                node.removeAttribute(attr);
            }

            model.on('change', prop, change);
            change();
          }
        };
      }
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

          rule: function(fragment, model, prop) {
            var textNode = document.createTextNode(model(prop) || '');
            fragment.appendChild(textNode);
            model.on('change', prop, function() {
              textNode.data = jtmpl.get(model, prop) || '';
            });
          }
        };
      }
    },




    /**
     * {{&var}}
     */
    function(node) {
      if (node.innerHTML.match(/^&[\w\.\-]+$/)) {
      }
    },




    /**
     * {{>partial}}
     */
    function(node) {
      // match: [1]=var_name, [2]='single-quoted' [3]="doube-quoted"
      if (node.innerHTML.match(/>([\w\.\-]+)|'([^\']*)\'|"([^"]*)"/)) {
      }
    },




    /**
     * {{#section}}
     */
    function(node) {
      var match = node.innerHTML.match(/^#([\w\.\-]+)$/);

      if (match) {

        return {

          block: match[1],

          rule: function(fragment, model, prop, template) {

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

                // TODO: fixme, this is not correct!!!
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
    },





    /**
     * {{^inverted_section}}
     */
    function(node) {
      var match = node.innerHTML.match(/^\^([\w\.\-])+$/);

      if (match) {
      }
    }

  ]
};
