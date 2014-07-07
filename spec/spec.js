// require('simple-server');

// var page = require('webpage').create();

// page.onConsoleMessage = function(msg) {
//   console.log(msg);
// };

// page.onResourceRequested = function(request) {
//   console.log('Request ' + JSON.stringify(request, undefined, 4));
// };

// page.onResourceReceived = function(response) {
//   console.log('Receive ' + JSON.stringify(response, undefined, 4));
// };    

// var fs = require('fs');
// page.open('file://' + fs.workingDirectory + '/index.html', function(status) {
//   page.evaluate(function() {
//     // Tests are in the page, just eval it and capture console messages
//   });
//   phantom.exit();
// });


// var connect = require('connect');
// var serveStatic = require('serve-static');
// connect().use(serveStatic(__dirname)).listen(3000);
require('simple-server'); 

var phantom = require('phantom');

phantom.create(function (ph) {
  ph.createPage(function (page) {

    page.set('onConsoleMessage', function(msg) {
      console.log(msg);
    });

    page.open('http://localhost:3000/spec/index.html', function (status) {
      page.evaluate(function () {}, function (result) {
        ph.exit();
        // require('connect').close();
      });
    });
  });
});