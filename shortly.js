var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
//sessions
// app.use(session({secret: "yourguy"}));
app.use(session({
    secret: "yourmom",
    resave: true,
    saveUninitialized: true
}));


app.get('/', restrict, function(req, res) {
  restrict(req, res, function(){
    res.render('index');
  });
});

app.get('/create', restrict, function(req, res) {
  res.render('index');
});

app.get('/links', restrict, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404)
  }
  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});
/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.get('/logout', function(request, response){
  request.session.destroy(function(){
    response.redirect('/');
  });
});



// app.post('/signup', function(request, response) {

//   db.knex('users').insert(request.body).then(function(){
//     login(request, response);
//   });

// });
//
//
app.post('/signup', function(request, response){
  var thisUsername = request.body.username;

  new User({username: thisUsername}).fetch().then(function(found){
    if (found) {
      setSession(request, response, thisUsername, function(){
        response.redirect(301, '/')
      })

    } else {
      var user = new User({username: thisUsername});
      setSession(request, response, thisUsername, function(){
        user.save().then(function(newUser){
          Users.add(newUser);
          response.redirect(301, '/')
        });

      });


    }
  });
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/login', function(request, response){
  db.knex('users').where(request.body).then(function(user){
    if(user.length){
      setSession(request, response, user[0].username, function(){

        response.redirect(301, '/');
      });
    }else{
      response.redirect(301, '/login')
    }
  });

});

function setSession(request, response, username, cb){
  request.session.regenerate(function(){
    request.session.user = username;
    cb();
  });
}

function restrict(req, res, next) {
  // console.log(JSON.stringify(req.session))
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
