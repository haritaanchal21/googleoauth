/*  EXPRESS */
const express = require('express');
const session = require('express-session');
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const mime = require('mime-types');
const fs = require('fs');
const ejs = require("ejs");
const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: 'secret-word',
    saveUninitialized: false,
    resave: false
}));
require('dotenv').config()
const port = 3000;
app.listen(port, () => console.log('App listening on port ' + port));


var passport = require('passport');
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

authUser = (request, accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
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
    res.render('auth');
});

app.get('/success', checkAuthenticated, async (req, res) => {
    if (!req.session.user) {
        req.session.user = { id: req.user.id ,name: req.user.displayName, email: req.user.emails[0].value, errorMessage: '' };
    }
    if (!fs.existsSync("./uploads")) {
        fs.mkdirSync("./uploads");
    }
    const dir = `./uploads/${req.session.user.id}/`;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    try {
        const allfiles = await fs.promises.readdir(dir);
        const files = [];
        for (let file of allfiles) {
            const filePath = path.join(dir, file);
            const stats = await fs.promises.stat(filePath);
            files.push({
                fileName: file,     
                filePath,
                fileType: mime.lookup(file),
                fileCreate: stats.ctime,
                lastModified: stats.mtime
            });
        }
        const user = { id: req.user.id ,name: req.user.displayName, email: req.user.emails[0].value };
        const errorMessage = req.session.user.errorMessage;
        req.session.user.errorMessage = "";
        res.render('success', { user, files,errorMessage});
    } catch (err) {
        console.log(err);
        return res.status(500).send(err);
    }
    
});

//upload file
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (!fs.existsSync("./uploads")) {
            fs.mkdirSync("./uploads");
        }
        const dir = `./uploads/${req.session.user.id}/`;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const dir = `./uploads/${req.session.user.id}/`;
        const filePath = `${dir}/${file.originalname}`;
        if (fs.existsSync(filePath)) {
            cb(new Error("file already exist"));
        }
        cb(null, file.originalname);
    }   
});

const upload = multer({ storage: storage});
const uploadSingleImage = upload.single('file');
app.post('/upload', function (req, res) {

    uploadSingleImage(req, res, function (err) {

        if (err) {
            req.session.user.errorMessage = err.message;
        }

        // Everything went fine.
        res.redirect("/success");
    })
});


//download onclick
const path = require('path');
app.get('/download/:file(*)', passport.authenticate('google', { scope: ['profile', 'email'] },{ failureRedirect: '/error' }), async (req, res) => {
    res.redirect('/error')
    console.log("hello worldf")
    var file = req.params.file;
    const dir = `./uploads/${req.session.user.id}/`;
    var fileLocation = path.join(dir, file);
    if(fs.existsSync(fileLocation)){
        res.download(fileLocation, file);
    } else {
        res.status(404).send('File not found');
    }
});

//logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});