module.exports.isloggedin=(req,res,next)=>{
    if(!req.isAuthenticated()){
        req.flash("error","please login to access the function");
        return res.redirect("/login");
    }
    next();
}