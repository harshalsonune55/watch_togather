const mongoose = require("mongoose");
const {Schema} = mongoose;


main()
.then((res)=>{
    console.log("successfully connected to database");
})
.catch(err => console.log(err));

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/airbnb');
}


const UserSchema=new Schema({
    username:String,
    email:String
});


const postSchema=new Schema({
    content:String,
    likes:Number,
    user:{
        type:Schema.Types.ObjectId,
        ref:"User"
    }
})

const customerSchema=new Schema({
name:String,
orders:[
    {
        type:Schema.Types.ObjectId,
        ref:"Order",
    }
]

})

const orderSchema = new Schema({
    item:String,
    price:Number,
});

const Order=mongoose.model("Order",orderSchema);
const Customer=mongoose.model("Customer",customerSchema);
const User=mongoose.model("User",UserSchema);
const Post=mongoose.model("Post",postSchema);

// customerSchema.pre("findOneAndDelete",async()=>{
//     console.log("PRE middleware");
// });


customerSchema.post("findOneAndDelete",async(customer)=>{
    if(customer.orders.length){
       let res= await Order.deleteMany({_id: {$in:customer.orders}});
       console.log(res);
    }
});


// const addPost=async()=>{
//     let user1=await new User({
//         username:"Rahul",
//         email:"rahul@rahul.com"
//     });

//     let Post1=await new Post({
//         content:"hello World",
//         likes:7
//     });

//     Post1.user=user1;

//     await user1.save();
//     let res=await Post1.save();
//     console.log(res);

// }
// addPost();

// const findcustomer=async ()=>{
//     let res=await Customer.find({}).populate("orders");
//     console.log(res);
// }

// findcustomer();

// const addcustomer=async ()=>{
//     let cust1= new Customer({
//         name:"kunal mishra",
//     });
//     let order= new Order({
//         item:"allo",
//         price:200
//     });
//     cust1.orders.push(order);
//     await order.save();
//     await cust1.save();
//     console.log("customer added");

// }
// addcustomer();

const delcust=async ()=>{
    let res= await Customer.findByIdAndDelete('67a1a39042083e7d84b7c99f');
    console.log(res);
}

delcust();

// const addOrders=async()=>{
//   let res= await Order.insertMany([
//     {item:"samosa",price:12},
//     {item:"chips",prics:10},
//     {item:"chocolate",price:40}
// ]);
// console.log(res);
// };

// addOrders();