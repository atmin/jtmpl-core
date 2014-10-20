/**
 * Compile a template, parsed by @see parse
 *
 * @param {documentFragment} template
 *
 * @returns {string} - Function body, accepting Freak instance parameter, suitable for eval()
 */
function compile(template) {

  // Generate dynamic function body
  var result = '(function(model) {' +
    'var frag = document.createDocumentFragment(), node;';

  // Iterate childNodes
  for (var i = 0, childNodes = template.childNodes, len = childNodes.length;
       i < len; i++) {

    switch (childNodes[i].nodeType) {

      // Element node
      case 1:

        // Create element
        result += 'node = document.createElement("' + childNodes[i].nodeName + '");';

        // Clone attributes
        for (var ai = 0, attributes = childNodes[i].attributes, alen = attributes.length;
            ai < alen; ai++) {
          result += 'node.setAttribute("' +
            attributes[ai].name +
            '", ' +
            JSON.stringify(attributes[ai].value) +
            ');';
        }

        // Recursively compile
        result += 'node.appendChild(' + compile(childNodes[i], model, options) + '());';

        // Append to fragment
        result += 'frag.appendChild(node);';
        break;


      // Text node
      case 3:
        result += 'frag.appendChild(document.createTextNode(' +
          JSON.stringify(childNodes[i].data) + '));';
        break;


      // Comment node
      case 8:
        result += 'frag.appendChild(document.createComment(' +
          JSON.stringify(childNodes[i].data) + '));';
        break;

    } // end switch
  } // end iterate childNodes

   result += 'return frag; })';

  return result;
}



module.exports = compile;
