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


var app = require('connect')().use(require('serve-static')(__dirname));
var srv = require('http').createServer(app);
var phantom = require('phantom');

setTimeout(function() {

  phantom.create(function (ph) {
    ph.createPage(function (page) {

      page.set('onConsoleMessage', function(msg) {
        console.log(msg);
      });

      page.open('http://localhost:3000', function (status) {
        page.evaluate(function () {}, function (result) {
          ph.exit();
          console.log('Closing server')
          srv.close();
        });
      });
    });
  });

}, 0);

console.log('Listening on 3000...')
srv.listen(3000);