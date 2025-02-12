require("dotenv").config();

const express=require("express");
let app=express();
const port=process.env.PORT || 8080;
// const mongoose=require("mongoose");
const path=require("path");
// const List=require("./database/dataadding.js");
var methodOverride = require('method-override');
const engine = require('ejs-mate');
const http = require("http");
const socketIo = require("socket.io");


//storing message
let user1="";
const message=[];

app.engine('ejs', engine);
app.use(express.static(path.join(__dirname,"public")));
app.set("view engine","ejs");
app.set("views",path.join(__dirname,"/views"));
app.use(express.urlencoded({extended:true}));
app.use(methodOverride('_method'));
const server = http.createServer(app);
const io = socketIo(server);



// main()
// .then((res)=>{
//     console.log("successfully connected to database");
// })
// .catch(err => console.log(err));

// async function main() {
//   await mongoose.connect(process.env.MONGO_URL);
// }

 
// app.get("/home",async(req,res)=>{
//     let lists= await List.find({});
//     res.render("homepage.ejs",{lists});

// });


// app.post("/add",async(req,res)=>{
//     let data=req.body;
//     let data1= new List({
//         title:data.title,
//         description:data.description,
//         image:{
//             filename:"listingimage",
//             url:data.img
//         },
//         country:data.country,
//         location:data.location,
//         price:data.price

//     });
//     await data1.save().then((res)=>{
//         console.log(res);
//     }).catch((err)=>{
//         console.log(err);
//     });
//     res.redirect("/home");
// })

// app.get("/add",(req,res)=>{
// res.render("add.ejs");

// });

// app.put("/edit/:id",async(req,res)=>{
// let {id}=req.params;
// let data=req.body;
// await List.findByIdAndUpdate(id,{
//     title:data.title,
//     description:data.description,
//     image:{
//         filename:"listingimage",
//         url:data.img
//     },
//     country:data.country,
//     location:data.location,
//     price:data.price
// },{runValidators:true,new:true})
// res.redirect("/home");

// });

// app.get("/edit/:id",async(req,res)=>{
// let {id}=req.params;
// let data=await List.findById(id);
// res.render("edit.ejs",{data});

// });

// app.delete("/delete/:id",async(req,res)=>{
// let {id}=req.params;
// await List.findByIdAndDelete(id)
// .then((res)=>{
//     console.log(res);
// })
// .catch((err)=>{
//     consle.log(err);
// });
// res.redirect("/home");

// });

// app.get("/delete/:id",async(req,res)=>{
//     let {id}=req.params;
//     let data=await List.findById(id);
//     res.render("delete.ejs",{data});
// });

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});




app.get("/video",(req,res)=>{
    res.render("video1.ejs");
});




app.post("/video", (req, res) => {
    const link = req.body.videoLink;
    const name = req.body.displayName;

    const match = link.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|.+?&v=))([^?&]+)/);
    const videoId = match ? match[1] : null;

    if (!videoId) {
        return res.render("video", { videoId: null, error: "Invalid YouTube link!" });
    }
    user1=name;
    res.render("video.ejs", { videoId, name, messages: []});
});


io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("join", (user1) => {
        socket.username = user1;
        io.emit("userJoined", user1);
    });

    socket.on("sendMessage", (message) => {
        const time = new Date().toLocaleTimeString();
        io.emit("receiveMessage", { sender: socket.username, text: message, time });
    });

    socket.on("disconnect", () => {
        if (socket.username) {
            io.emit("userLeft", socket.username);
        }
    });
});



