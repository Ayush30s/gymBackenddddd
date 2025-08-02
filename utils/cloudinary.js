const cloudinary = require("cloudinary").v2;

const fun = async(path) => {
    cloudinary.config({ 
        cloud_name: 'dzblab9we', 
        api_key: '575212773332514', 
        api_secret: 'ghj2avDgbHGv81YNAzo95uvpnHg'
    });
    
    const uploadResult = await cloudinary.uploader.upload(path);
    return uploadResult;
}

// fun("./Public/uploads/1725900255150download (4).jpg");
module.exports = fun;