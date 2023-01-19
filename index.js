/*  EXPRESS */
const express = require('express');
const session = require('express-session');
const cookieParser = require("cookie-parser");

const ejs = require("ejs");
const app = express();
app.set('view engine', 'ejs');
app.use(session({
    secret: 'secret-word',
    saveUninitialized: false,
    resave: false
}));

const port = 3000;
app.listen(port, () => console.log('App listening on port ' + port));


var passport = require('passport');
var userProfile;
app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user)
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

/*  Google AUTH  */

const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const GOOGLE_CLIENT_ID = 'removed_for_security_purpose';
const GOOGLE_CLIENT_SECRET = 'removed_for_security_purpose';

authUser = (request, accessToken, refreshToken, profile, done) => {
    userProfile = profile;
    return done(null, userProfile);
}
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback",
    passReqToCallback: true
}, authUser));

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', {
        successRedirect: '/success',
        failureRedirect: '/error',
    }));

checkAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) { return next() }
    res.redirect('/')
}
app.get('/', (req, res) => {
    res.render('pages/auth');
});

app.get('/success', checkAuthenticated, (req, res) => {
    res.render('pages/success', { user: userProfile });
});

app.get('/error', (req, res) => res.send("error logging in"));


//upload file
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = `./uploads/${userProfile.id}/`;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage});
app.post('/upload', upload.single('file'), (req, res) => {
    // req.file contains information about the uploaded file
    // req.body contains other form fields
    console.log(req.file);
    //app.alert('File uploaded!');
    res.redirect('/success');
});


//list file
const fs = require('fs');
app.get('/files', (req, res) => {
    const dir = `./uploads/${userProfile.id}/`;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    fs.readdir(dir, (err, files) => {
        if (err) {
            console.log(err);
            return res.status(500).send(err);
        }
        res.render('files', { files: files });
    });
});
        


//download onclick
var path = require('path');
app.get('/download/:file(*)', (req, res) => {
    var file = req.params.file;
    const dir = `./uploads/${userProfile.id}/`;
    var fileLocation = path.join(dir, file);
    res.download(fileLocation, file);
});

//logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});