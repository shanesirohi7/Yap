require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const app = express();

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error(err));


const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    school: { type: String, default: 'SAJS' }
}));

const Post = mongoose.model('Post', new mongoose.Schema({
    content: String,
    likes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
}));

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));
function redirectIfLoggedIn(req, res, next) {
    if (req.session.user) {
        
        return res.redirect('/home');
    }
    next(); 
}

app.get('/', async (req, res) => {
    if (req.session.user) return res.redirect('/home');

    
    const demoPosts = await Post.find().sort({ createdAt: -1 }).limit(5);

    const currentTime = Date.now();
    const demoPostsWithTime = demoPosts.map(post => {
        const timeDiff = currentTime - post.createdAt.getTime();
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        const timeAgo = hoursAgo > 0 ? `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago` : 'Just now';
        return { ...post.toObject(), timeAgo };
    });

    res.render('index', { demoPosts: demoPostsWithTime });
});

app.get('/signup', redirectIfLoggedIn, (req, res) => res.render('signup'));
app.post('/signup', redirectIfLoggedIn, async (req, res) => {
    const { name, email, password } = req.body;

    try {
        
        const hashedPassword = await bcrypt.hash(password, 10);

       
        const user = new User({ name, email, password: hashedPassword });

        await user.save();

        
        res.redirect('/login');
    } catch (err) {
       
        if (err.code === 11000 && err.keyPattern.email) {
            return res.status(400).render('signup', { error: 'Email already exists. Please log in or use a different email.' });
        }

        
        console.error(err);
        return res.status(500).render('signup', { error: 'An error occurred during signup. Please try again later.' });
    }
});

app.get('/login', redirectIfLoggedIn, (req, res) => res.render('login'));
app.post('/login', redirectIfLoggedIn, async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = { id: user._id, name: user.name };
        return res.redirect('/home');
    }
    res.redirect('/login');
});

app.get('/home', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const posts = await Post.find().sort({ createdAt: -1 });

    
    const currentTime = Date.now();
    const postsWithTime = posts.map(post => {
        const timeDiff = currentTime - post.createdAt.getTime(); 
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60)); 
        const timeAgo = hoursAgo > 0 ? `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago` : 'Just Now';
        return { ...post.toObject(), timeAgo };
    });

    res.render('home', { user: req.session.user, posts: postsWithTime });
});

app.post('/post', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    await new Post({ content: req.body.content }).save();
    res.redirect('/home');
});

app.post('/like/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    await Post.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } });
    res.redirect('/home');
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
//Moving on to views(app.js done)
