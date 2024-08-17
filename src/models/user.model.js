import mongoose, {Schema} from "mongoose"
import jwt from "jsontoken"
import bcrypt from "bcrypt"




const userSchema= new Schema(
    {
        username:{
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true , // make easily searchable
        },
        email:{
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            
        },
        fullname:{
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true,
            
        },
        avatar:{
            type: String,  //cloudinary url  when we upload images or files it gives url
             required: true,
            
            
        },
        coverImage:{
            type: String,  //cloudinary url  when we upload images or files it gives url   
        },
        watchHistory:[
            {
            type: Schema.Types.ObjectId,
            ref: "video"
        
        }
    ],
    password:{
        type: String,
        required: [true, 'password is required' ]
    },
    refreshToken:{
        type: String
    }

},
{
    timestamps: true
}
)


userSchema.pre("save", async function (next) {
    if(!this.isModified("password"))

    return next()

    this.password = bcrypt.hash(this.password, 10) //this line encrypt password
    next()
})  //koi bhi data delete save update karne se kuchh kaam karna ho toh pre hook
// This line sets up a "pre-save" hook for the user schema.
   // - It's a function that runs before the user data is saved to the database.
// but priblem is that jab bhi ham kuchh bhi update karke save karenge baar baaar password encrypt hoga isiliye hamne condition aga di jab kewl password midify ho tabhi ham encrypt kare 

userSchema.methods.isPasswordCorrect = async function
(password){
return await bcrypt.compare(password, this.password)
}// this a method  for checking password jo ki bcerypt kar dega
// it will return true or false    


userSchema.methods.generateAccessToken= function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken= function(){
    return jwt.sign(
        {
            _id: this._id,
            
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}
//This method generates an access token that can be used to authenticate the user in future requests. The token contains the user's data and is signed with a secret key to ensure authenticity.
export const User = mongoose.model("User",userSchema)

//bcrypt library for password  and jsonwebtoken for token