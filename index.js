/*  EXPRESS */
const express = require('express');
const session = require('express-session');
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const mime = require('mime-types');
const fs = require('fs');
const ejs = require("ejs");
const app = express();
const path = require('path');
var cors = require('cors');
app.use(cors());


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

app.get('/auth/google', function (req, res, next) {
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: JSON.stringify({ authType: 'user', file: '' })
    })(req, res, next);
});
app.get('/auth/google/callback', function (req, res, next) {
    passport.authenticate('google', function (err, user, info) {
        if (err) { return next(err); }
        if (!user) { return res.status(302).send({ error: 'Not Authorized' }); }

        req.logIn(user, function (err) {
            if (err) { return next(err); }
            // Redirect based on the authentication type stored in the session.
            let authType = JSON.parse(req.query.state).authType;
            if (authType === 'user') {
                return res.redirect('/success');
            }
            else if (authType === 'download') {
                let file = JSON.parse(req.query.state).file;
                const dir = `./uploads/${user.id}/`;
                var fileLocation = path.join(dir, file);
                if (fs.existsSync(fileLocation)) {
                    res.download(fileLocation, file);
                } else {
                    return next(new Error("Unauthorized"));
                }
            }
        });
    })(req, res, next);
});

checkAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) { return next() }
    res.redirect('/')
}
app.get('/', (req, res) => {
    return res.render('auth');
});

app.get('/success', checkAuthenticated, async (req, res) => {
    if (!req.session.user) {
        req.session.user = { id: req.user.id, name: req.user.displayName, email: req.user.emails[0].value, errorMessage: '' };
        req.session.authType = 'user';
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
        const user = { id: req.user.id, name: req.user.displayName, email: req.user.emails[0].value };
        const errorMessage = req.session.user.errorMessage;
        req.session.user.errorMessage = "";
        res.render('success', { user, files, errorMessage });
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
            cb(new Error("file with same name already exist, please choose another name"));
        }
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });
const uploadSingleImage = upload.single('file');
app.post('/upload', function (req, res) {
    uploadSingleImage(req, res, function (err) {
        if (err) {
            return res.status(500).send({ error: err.message });
        }
        // Everything went fine.
        return res.status(200).send({ message: "Image uploaded successfully" });
    });
});
// app.post('/upload', function (req, res) {

//     uploadSingleImage(req, res, function (err) {

//         if (err) {
//             req.session.user.errorMessage = err.message;
//             return res.status(200).redirect("/success");

//         }
//         // Everything went fine.
//         return res.redirect("/success");
//     })
// });



//download onclick
app.get('/download/:file(*)', function (req, res, next) {
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: JSON.stringify({ authType: 'download', file: req.params.file })
    })(req, res, next);
});

app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Something went wrong');
});

//logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});
