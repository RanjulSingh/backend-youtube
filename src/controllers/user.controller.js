import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User}  from  "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import  { ApiResponse}  from "../utils/apiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"


const generateAccessAndRefreshTokens = async(userId) => {
    try{
         const user = await User.findById(userId)
         const accessToken = user.generateAccessToken()
         const refreshToken = user.generateRefreshToken()

         user.refreshToken = refreshToken
         await user.save({validateBeforeSave: false})
         
         return {accessToken, refreshToken}
    }catch(error){
        throw new ApiError(500, "something went wrong while generatinh refresh ans access token")
    }
}



const registerUser = asyncHandler(async (req, res)=>{
   //get user details from frontend
   //validation - not empty
   //check if user already exist: username,email
   //check for images , check for avatar
   //upload them to cloudinary, avatar
   //create user object - create entry in db
   //remove password and refressh token field from response
   //check for user creation 
   //return response

   const {fullName, email, username,password}=req.body
   console.log("email: ", email);

//    if(fullName=="")
//    {
//     throw new ApiError(400, "full name is required")
//    } ye ek ek karke check kar sakte hai lekin agar sab ek saath check karna ho toh neeche wala syntax

if(
    [fullName, email,username,password].some((field)=>
    field?.trim()==="")
){
    throw new ApiError(400, "All fields are required")

}

const existedUser = await User.findOne({
    $or: [{ username }, { email }]
})
console.log('existeduser', existedUser)


if(existedUser){
    throw new ApiError(409, "user with email already exists")
}


const avatarLocalPath = req.files?.avatar[0]?.path;
const coverImageLocalPath = req.files?.coverImage[0]?.path;

// let coverImageLocalPath;
// if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
// coverImageLocalPath =  req.files.coverImage[0].path;
// }//this is classic way of checking

if(!avatarLocalPath)
{
    throw new ApiError(400, "avatar file is required")
}

const avatar = await uploadOnCloudinary(avatarLocalPath)
const coverImage = await uploadOnCloudinary(coverImageLocalPath)

if(!avatar)
{
    throw new ApiError(400, "avatar is required")
}



const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username ? username.toLowerCase() : "",
})




const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
)

if(!createdUser){
    throw new ApiError(500, "something went error while registering the user")

}

return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered successfully")
)
})



const loginUser =asyncHandler(async (req, res)=> {
    //req body -> data
    //username or email
    //find the user
    // password check
    //access and refresh token generate
    //send cookies
    const {email, username,password}= req.body

    if(!username && !email)
    {
        throw new ApiError(400, "username or password is required")

    }

    const user = await User.findOne({
        $or : [{ username },{ email }]
    })

    if(!user)
    {
        throw new ApiError(404,"user does  ot exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid)
    {
        throw new ApiError(401, "Invalid user credentials")
    }

const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

const loggedInUser = await User.findById(user._id).
select("-password -refreshToken")

const options = {//isse kya hota hai ki hamari cookie kewal server se modify hogi kyunki hamne http true kar diya nhi toh koi bhi modify kar sakta tha
    httpOnly: true,
    secure: true
}

return res
.status(200)
.cookie("accessToken", accessToken, options)
.cookie("refreshToken",refreshToken,options)
.json(
    new ApiResponse(
        200,
    {
        user: loggedInUser, accessToken,//jab user khud apni taraf se access aur refresh token refresh karna chah raha ho 
        refreshToken
    } , 
    "user logged in successfully"
)
)

})


const logoutUser = asyncHandler(async(req, res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
            {
                new: true
            }
        )

        const options = {//isse kya hota hai ki hamari cookie kewal server se modify hogi kyunki hamne http true kar diya nhi toh koi bhi modify kar sakta tha
            httpOnly: true,
            secure: true
        }

        return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200,{}, "user logged out successfully"))
})


const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.
    refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized request")
    }

    try{

    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    )

    const user = User.findById(decodedToken?._id)

    if(!user){
        throw new ApiError(401, "invalid refresh token")
    }

    if(incomingRefreshToken !== user?.refreshToken){
        throw new ApiError(401, "refresh token is expired or used")

    }

    const options = {
        httpOnly: true,
        secure: true
    }

   const {accessToken, newrefreshToken} = await  generateAccessAndRefreshTokens(user._id)

   return res
   .status(200)
   .cookie("accessToken", accessToken,options)
   .cookie("refreshToken", newrefreshToken, options)
   .json(
    new ApiResponse(
        200,
        {accessToken, refreshToken: newRefreshToken},
        "access token refreshed"
    )
   )
}catch(error){
    throw new ApiError(401, error?.message || "invalid referesh Token")
}
})


const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword} = req.body
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "invalid old password")
}

user.password = newPassword//NAYA PASSWORD SET KAR DIYA
await user.save({validateBeforeSave: false})

return res.status(200)
.status(200)
.json(new ApiResponse(200,{},"password changed successfully"))
})


const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user, "current user fetched successfully"))

})


const updateAccountDetails = asyncHandler(async(req,res)=>{//if we want to update user details
const {fullName,email} = req.body
if(!fullName || !email){
    throw new ApiError(400,"all fields are required")

}

const user =  User.findByIdAndUpdate(
    req.user._id,
    {
        $set: {
            fullName,
            email: email
        }
    },
    {new: true}
).select("-password")

return res.
status(200)
.json(new ApiResponse(200,user, "Account Details updated successfully"))

})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path//agar file present hai toh patrh le lo
    
    if(!avatarLocalPath){
        throw new ApiError(400, "avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocal)

    if(!avatar.url){
        throw new ApiError(400, "error while uploading avatar ")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("_password")


return res
    .status(200)
    .json(new ApiResponse(200, user, "avatar  updated successfully"))
})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path//agar file present hai toh patrh le lo
    
    if(!coverImageLocalPath){
        throw new ApiError(400, "cover image  file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "error while uploading coverImage ")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
            coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("_password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "cover image updated successfully"))
})



const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} = req.params//hamien uski profile url se milegi jo ki hai params

    if(!username?.trim()){
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([//in first pipeline we are finding subscribers
        {
            $match:{
                username: username?.toLowerCase()
            }
        },
            {
                $lookup:{
                    from : "subscriptions",
                    localField: "_id",
                    foriegnField: "channel",
                    as : "subscribers"//new field is added  using pipeline that contains subscribers
                }
            },
            {
                $lookup: {
                    from : "subscriptions",
                    localField: "_id",
                    foriegnField: "subscriber",
                    as : "subscribedTo"//new field is added
                }
            },
            {
                $addfields:{
                    subscribersCount:{
                        $size: "subscribers"//counts no os subscribers from subscribers field
                    },
                    channelsSubscribedToCount:{
                        $size:"$subscribedTo"
                    },
                    isSubscribed:{
                        $cond: {
                            if: {$in:[req.user?._id,"$subscribers.subscriber"]}, //ye in check kar raha ki subscribers field mien wo subscriber hai yaa nhi
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $project:{//projection hai ki sari values ko nhi but selected cheejien dungi
                    fullName: 1,
                    username: 1,
                    subscribersCount: 1,
                    channelSubscribedToCount: 1,
                    avatar: 1,
                    coverImage: 1,
                    email: 1,
                    isSubscribed: 1
                }
            }
        
    ])

if(!channel?.length){
throw new ApiError(404, "channel does not exists")

}

return res
.status(200)
.json(
    new ApiResponse(200, "user channel fetched successfully")
)

})

const getWatchHistory = asyncHandler(async(req,res)=>{
const user = await User.aggregate([
    {
        $match:{
            _id: new mongoose.Types.ObjectId(req.user._id)
        }
    },
    {
        $lookup:{
            from : "videos",
            localField: "watchHistory",
            foriegnField: "_id",
            as: "watchHistory",
            pipeline:[
                {
                $ookup:{
                    from: "users",
                    localField: "owner",
                    foriegnField: "_id",
                    as : "owner",
                    pipeline:[
                        {
                        $project:{
                             fullName: 1,
                             username: 1,
                             avatar: 1
                        }
                    }
                    ]

                }
            },
            {
                $addFields:{
                    owner:{
                        $first: "$owner"
                    }
                }
            }
        ]

        }
    }
])

return res
.status(200)
.json(
    new ApiResponse(
        200,
        user[0].watchHistory, //user ki watch history deni hai
        "watch history fetched successfully"
    )
)
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile ,
    getWatchHistory

}