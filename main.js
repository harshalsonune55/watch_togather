require("dotenv").config();
const flash=require("connect-flash");
const express=require("express");
let app=express();
const port=process.env.PORT;
const mongoose=require("mongoose");
const path=require("path");
var methodOverride = require('method-override');
const engine = require('ejs-mate');
const http = require("http");
const { Server } = require('socket.io');
const Userp=require("./database/users.js");
const session=require("express-session");
const {isloggedin}=require("./middlewere/login_auth.js");
const passport=require("passport");
const localStrategy=require("passport-local");


const sessionOption={
    secret:"My super Sceret code",
    resave:false,
    saveUninitialized:true,
    cookie:{
        expires:Date.now() + 7*24*60*60*1000,
        maxAge:7*24*60*60*1000,
        httpOnly:true
  
    }
  
  }

//storing message
let user1="";
const message=[];


app.use(session(sessionOption));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStrategy(Userp.authenticate()));
passport.serializeUser(Userp.serializeUser());
passport.deserializeUser(Userp.deserializeUser());
app.engine('ejs', engine);
app.use(express.static(path.join(__dirname,"public")));
app.set("view engine","ejs");
app.set("views",path.join(__dirname,"/views"));
app.use(express.urlencoded({extended:true}));
app.use(methodOverride('_method'));
const server = http.createServer(app);
const io = new Server(server);
app.use(flash());
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
  });




  app.post("/signup",async(req,res)=>{
    let{Username,Email,Password,Confirm_Password}=req.body;
    try{
      if(Password==Confirm_Password){
        let newUser=new Userp({
            email:Email,
            username:Username,
      })
      req.session.name=Username;
      let regestiredUser= await Userp.register(newUser,Password);
      req.flash("success","sign-up successfully");
      req.login(regestiredUser, function(err) {
        if (err) { return next(err); }
        req.flash("success","welcome to watch togather");
        return res.redirect('/video');
      });
      
      }else{
        req.flash("error", "Re-entered password did not match!");
        return res.redirect("/signup");
      }
    }catch(e){
      console.log(e)
      req.flash("error","user already exist!");
      return res.redirect("/signup")
    }
    
    
    });


const DBURL=process.env.DBURL;    

main()
.then((res)=>{
    console.log("successfully connected to database");
})
.catch(err => console.log(err));

async function main() {
  await mongoose.connect(DBURL);
}

app.get("/signup",(req,res)=>{
res.render("signup.ejs");
});

app.get("/video",isloggedin,(req,res)=>{
    let username=req.user.username;
    res.render("video1.ejs",{username});
});




app.post("/video",isloggedin, (req, res) => {
    const link = req.body.videoLink;
    const name = req.user.username;

    const match = link.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|.+?&v=))([^?&]+)/);
    const videoId = match ? match[1] : null;

    if (!videoId) {
        return res.render("video", { videoId: null, error: "Invalid YouTube link!" });
    }
    user1=name;
    res.render("video.ejs", { videoId, name, messages: []});
});


io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
  
    socket.on('chat message', (msg) => {
      io.emit('chat message', msg); 
    });
  
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });


app.get("/login",(req,res)=>{
    res.render("login.ejs");
    });

app.post("/login",passport.authenticate('local', { failureRedirect: '/login' ,failureFlash:true}),async(req,res)=>{
    req.flash("success","Welcome to editor!");
    res.redirect("/video");
});

app.post('/logout', function(req, res, next){
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/signup');
    });
  });

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});



