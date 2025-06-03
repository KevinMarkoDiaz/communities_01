import { upload } from '../config/cloudinary.js';

export const uploaderMiddleware = upload.fields([
  { name: 'featuredImage', maxCount: 1 },
  { name: 'profileImage', maxCount: 1 },
  { name: 'images', maxCount: 5 },
]);

export const imageProcessor = (req, res, next) => {
  const files = req.files;

  if (files?.featuredImage?.[0]) {
    req.body.featuredImage = files.featuredImage[0].path;
  }

  if (files?.profileImage?.[0]) {
    req.body.profileImage = files.profileImage[0].path;
  }

  if (files?.images?.length > 0) {
    req.body.images = files.images.map(file => file.path);
  }

  next();
};

export const singleProfileImageUpload = upload.single('profileImage');

export const handleProfileImage = (req, res, next) => {
  if (req.file) {
    req.body.profileImage = req.file.path;
  }
  next();
};

export const uploadCommunityImages = upload.fields([
  { name: 'flagImage', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 },
]);

export const processCommunityImages = (req, res, next) => {
  const files = req.files;

  if (files?.flagImage?.[0]) {
    req.body.flagImage = files.flagImage[0].path;
  }

  if (files?.bannerImage?.[0]) {
    req.body.bannerImage = files.bannerImage[0].path;
  }

  next();
};
