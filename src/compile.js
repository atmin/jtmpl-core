/**
 * Compile a template, parsed by @see parse
 *
 * @param {documentFragment} template
 * @param {string|undefined} sourceURL - include sourceURL to aid debugging
 *
 * @returns {string} - Function body, accepting Freak instance parameter, suitable for eval()
 */
function compile(template, sourceURL) {

  // Compile rules, for attributes and nodes
  var compileRules = require('./compile-rules');
  var match, block;

  // Generate dynamic function body
  var func = '(function(model) {\n' +
    'var frag = document.createDocumentFragment(), node;\n\n';


  // Iterate childNodes
  for (var i = 0, childNodes = template.childNodes, len = childNodes.length, node;
       i < len; i++) {

    node = childNodes[i];

    switch (node.nodeType) {

      // Element node
      case 1:

        // jtmpl tag?
        if (node.nodeName === 'SCRIPT' && node.type === 'text/jtmpl-tag') {

          for (var ri = 0, rules = compileRules.node, rlen = rules.length;
              ri < rlen; ri++) {
            match = rules[ri](node);

            // Rule found?
            if (match) {

              // Block tag?
              if (match.block) {

                // Fetch block template
                block = document.createDocumentFragment();
                for (i++;
                    (i < len) && !matchEndBlock(match.block, childNodes[i].innerHTML || '');
                    i++) {
                  block.appendChild(childNodes[i].cloneNode(true));
                }

                if (i === len) {
                  throw 'jtmpl: Unclosed ' + match.block;
                }
                else {
                  func += '(' + match.rule.toString() + ')' +
                    '(frag, ' +
                    JSON.stringify(match.block) +
                    ', model, ' +
                    JSON.stringify(compile(block)) + ');';
                }

              }
              // Inline tag
              else {
                func += '(' + match.rule.toString() + ')' +
                  '(frag, ' + JSON.stringify(match.prop) + ', model);\n';
              }

              // Skip remaining rules
              break;
            }
          } // end iterating node rules

          // TODO: what to do with non-matching rules?
          if (!match) {
            func += 'node = document.createTextNode("REMOVEMELATER");\n';
            func += 'frag.appendChild(node);\n';
          }
        }

        else {
          // Create element
          func += 'node = document.createElement("' + node.nodeName + '");\n';

          // Clone attributes
          for (var ai = 0, attributes = node.attributes, alen = attributes.length;
               ai < alen; ai++) {
                 func += 'node.setAttribute("' +
                   attributes[ai].name +
                   '", ' +
                   JSON.stringify(attributes[ai].value) +
                   ');\n';
               }

          // Recursively compile
          func += 'node.appendChild(' + compile(node) + '());\n';

          // Append to fragment
          func += 'frag.appendChild(node);\n';
        }

        break;


      // Text node
      case 3:
        func += 'frag.appendChild(document.createTextNode(' +
          JSON.stringify(node.data) + '));\n';
        break;


      // Comment node
      case 8:
        func += 'frag.appendChild(document.createComment(' +
          JSON.stringify(node.data) + '));\n';
        break;

    } // end switch
  } // end iterate childNodes

  func += 'return frag; })';
  func += sourceURL ?
    '\n//@ sourceURL=' + sourceURL + '\n//# sourceURL=' + sourceURL + '\n' :
    '';

  return func;
}




function matchEndBlock(block, str) {
  var match = str.match(/\/([\w\.\-]+)?/);
  return match ?
    block === '' || !match[1] || match[1] === block :
    false;
}




module.exports = compile;
