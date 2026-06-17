const cloudinary = require('cloudinary').v2;
const env = require('../config/env');
const { errors } = require('../utils/app-error');

function ensureCloudinaryConfigured() {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw errors.cloudinary('Cloudinary env chưa được cấu hình');
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

function signedDownloadUrl(publicId, options = {}) {
  ensureCloudinaryConfigured();
  const expiresAt = new Date(Date.now() + env.SIGNED_URL_PUBLIC_TTL_SECONDS * 1000);
  const format = options.format || 'jpg';

  return {
    signed_url: cloudinary.utils.private_download_url(publicId, format, {
      resource_type: options.resource_type || 'image',
      type: 'upload',
      expires_at: Math.floor(expiresAt.getTime() / 1000),
      attachment: Boolean(options.attachment)
    }),
    expires_at: expiresAt.toISOString()
  };
}

module.exports = { signedDownloadUrl };
