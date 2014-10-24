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
      if (attr === 'jtmpl-selected' && match) {

        return {

          prop: match[1],

          rule: function(node, attr, model, prop) {

            function change() {
              if (node.nodeName === 'OPTION') {
                var i = selects.indexOf(node.parentNode);
                if (selectsUpdating[i]) {
                  return;
                }
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
                    selectsUpdating[i] = true;
                    for (var oi = 0, olen = selectOptions[i].length; oi < olen; oi++) {
                      selectOptionsContexts[i][oi](prop, selectOptions[i][oi].selected);
                    }
                    selectsUpdating[i] = false;
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
            setTimeout(change);
          }
        };
      }
    },




    /**
     * checked="{{var}}"
     */
    function(node, attr) {
      var match = node.getAttribute(attr).match(RE_DELIMITED_VAR);
      if (attr === 'jtmpl-checked' && match) {

        return {

          prop: match[1],

          rule: function(node, attr, model, prop) {

            function change() {
              if (node.name) {
                if (radioGroupsUpdating[node.name]) {
                  return;
                }
                for (var i = 0, len = radioGroups[node.name][0].length; i < len; i++) {
                  radioGroups[node.name][0][i].checked = radioGroups[node.name][1][i](prop);
                }
              }
              else {
                node.checked = model(prop);
              }
            }

            // radio group?
            if (node.type === 'radio' && node.name) {
              if (!radioGroups[node.name]) {
                // Init radio group ([0]: node, [1]: model)
                radioGroups[node.name] = [[], []];
              }
              // Add input to radio group
              radioGroups[node.name][0].push(node);
              // Add context to radio group
              radioGroups[node.name][1].push(model);
            }

            node.addEventListener('click', function() {
              if (node.type === 'radio' && node.name) {
                radioGroupsUpdating[node.name] = true;
                // Update all inputs from the group
                for (var i = 0, len = radioGroups[node.name][0].length; i < len; i++) {
                  radioGroups[node.name][1][i](prop, radioGroups[node.name][0][i].checked);
                }
                radioGroupsUpdating[node.name] = false;
              }
              else {
                // Update current input only
                model(prop, node.checked);
              }
            });

            model.on('change', prop, change);
            setTimeout(change);
          }

        };
      }
    },




    /**
     * class="{{#cond1}}class1{{/}} {{^cond2}}class2{{/}} ..."
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
                var size = chunkSize;

                while (size--) {
                  parent.removeChild(parent.childNodes[pos - 1]);
                }
                parent.insertBefore(
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

                //console.log('rendering ' + val.len + ' values');
                var func = eval(template);
                var child, childModel;
                for (i = 0, len = val.values.length; i < len; i++) {
                  // TODO: implement event delegation for array indexes
                  val.on('change', i, update(i));
                  //render.appendChild(eval(template + '(val(i))'));
                  //render.appendChild(func(val.values[i]));
                  childModel = val(i);
                  child = func(childModel);
                  child.__jtmpl__ = childModel;
                  render.appendChild(child);
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
                anchor.parentNode.__jtmpl__ = model;
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
            change();
            model.on('change', prop, change);
          }
        };
      }
    },





    /**
     * {{^inverted_section}}
     */
    function(node) {
      var match = node.innerHTML.match(/^\^([\w\.\-]+)$/);

      if (match) {

        return {

          block: match[1],

          rule: function(fragment, model, prop, template) {

            // Anchor node for keeping section location
            var anchor = document.createComment('');
            // Number of rendered nodes
            var length = 0;

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
                val.on('insert', change);
                val.on('delete', change);
                render = document.createDocumentFragment();

                if (val.len === 0) {
                  render.appendChild(eval(template + '(val(i))'));
                }

                length = render.childNodes.length;
                anchor.parentNode.insertBefore(render, anchor);
              }

              // Cast to boolean
              else {
                if (!val) {
                  render = eval(template + '(model)');
                  length = render.childNodes.length;
                  anchor.parentNode.insertBefore(render, anchor);
                }
              }
            }

            fragment.appendChild(anchor);
            change();
            model.on('change', prop, change);
          }


        };
      }
    }

  ]
};
