import multer from "multer"

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './public/temp')// I will keep all the files in this 
    },
    filename: function (req, file, cb) {

   cb(null,file.originalname)//jo user ne upload kiya tha
 }
  })
  
 export  const upload = multer({ 
    storage,

  })

  //we have done only set up till video number 10 and after we will code to make it use