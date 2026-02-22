import AdminModel from "../models/AdminSchema.js";
import { v2 as cloudinary } from "cloudinary";
import NewsUpdateModel from "../models/NewsUpdateSchema.js";
import SearchQuery from "../utils/SearchQuery.js";

// ADD NEWS
// METHOD : POST
// ENDPOINT: /api/news/add-news
const handleAddNews = async (req, res, next) => {
  try {
    const createdBy = await AdminModel.find().limit(1);
    const adminID = createdBy[0]._id;

    const { content, title } = req.body;

    const upload = req?.files?.upload;
    let thumbnail = "";
    let video = "";

    if (!content && !title) {
      return res.status(400).json({ message: "Title and Content are required" });
    }

    if (upload) {
      const uploadResult = await cloudinary.uploader.upload(upload.tempFilePath, {
        resource_type: "auto",
        folder: "news",
      });
      if (uploadResult.resource_type === "image") {
        thumbnail = uploadResult.secure_url;
      } else if (uploadResult.resource_type === "video") {
        video = uploadResult.secure_url;
      }
    }

    const createNews = new NewsUpdateModel({
      createdBy: adminID,
      title,
      content,
      thumbnail,
      video,
    });
    await createNews.save();
    return res.status(201).json({
      success: true,
      message: "News added successfully",
      data: createNews,
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

// GET NEWS
// METHOD : GET
// ENDPOINT: /api/news/get-news
const handleGetNews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || {};

    const matchStage = SearchQuery(search);
    const pipeline = [];

    if (matchStage) pipeline.push(matchStage);

    pipeline.push({
      $lookup: {
        from: "admins",
        localField: "createdBy",
        foreignField: "_id",
        as: "adminDetails",
      },
    });

    pipeline.push({
      $unwind: { path: "$adminDetails", preserveNullAndEmptyArrays: true },
    });

    pipeline.push({
      $project: {
        _id: 1,
        title: 1,
        thumbnail: 1,
        video: 1,
        content: 1,
        admin: {
          _id: "$adminDetails._id",
          username: "$adminDetails.username",
          profilePicture: "$adminDetails.profilePicture",
        },
      },
    });

    pipeline.push({ $sort: { createdAt: -1 } });

    
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const news = await NewsUpdateModel.aggregate(pipeline);

    const countPipeline = [];
    if (matchStage) countPipeline.push(matchStage);
    countPipeline.push({ $count: "totalItems" });

    const countResult = await NewsUpdateModel.aggregate(countPipeline);
    const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      news,
      meta: {
        totalItems,
        totalPages,
        page,
        limit,
      },
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// UPDATE NEWS
// METHOD : GET
// ENDPOINT: /api/news/:adminID/update-news/:newsID
const handleUpdateNews = async (req, res, next) => {
  try {
    const { adminID, newsID } = req.params;
    const { content, title } = req.body;

    // Check admin exists
    const findAdmin = await AdminModel.findById(adminID);
    if (!findAdmin) {
      return res.status(404).json({ message: "Admin Not Found" });
    }

    // Check news exists
    const findNews = await NewsUpdateModel.findById(newsID);
    if (!findNews) {
      return res.status(404).json({ message: "News Not Found" });
    }

    const upload = req?.files?.upload;

    if (upload) {
      const uploadResult = await cloudinary.uploader.upload(upload.tempFilePath, {
        resource_type: "auto",
        folder: "news",
      });

      if (uploadResult.resource_type === "image") {
        findNews.thumbnail = uploadResult.secure_url;
        findNews.video = ""; // clear video if new image
      } else if (uploadResult.resource_type === "video") {
        findNews.video = uploadResult.secure_url;
        findNews.thumbnail = ""; // clear image if new video
      }
    }

    // Update other fields
    findNews.title = title || findNews.title;
    findNews.content = content || findNews.content;

    await findNews.save();

    res.status(200).json({ message: "News Updated Successfully", data: findNews });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

export { handleAddNews, handleGetNews, handleUpdateNews };
