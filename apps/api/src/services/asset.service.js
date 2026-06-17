const cloudinary = require('cloudinary').v2;
const { Readable } = require('node:stream');
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

function uploadBuffer(buffer, options = {}) {
  ensureCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream({
      resource_type: options.resource_type || 'image',
      folder: options.folder,
      public_id: options.public_id,
      overwrite: options.overwrite ?? true,
      format: options.format,
      transformation: options.transformation
    }, (error, result) => {
      if (error) {
        reject(errors.cloudinary(error.message, { http_code: error.http_code }));
        return;
      }
      resolve(result);
    });

    Readable.from(buffer).pipe(upload);
  });
}

async function downloadBuffer(publicId, options = {}) {
  ensureCloudinaryConfigured();
  const url = cloudinary.url(publicId, {
    secure: true,
    resource_type: options.resource_type || 'image',
    type: options.type || 'upload',
    format: options.format,
    transformation: options.transformation
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw errors.cloudinary('Không tải được asset từ Cloudinary', {
      public_id: publicId,
      status: response.status
    });
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    content_type: response.headers.get('content-type') || options.mime_type || 'application/octet-stream'
  };
}

function cloudinaryMetadata(result) {
  return {
    public_id: result.public_id,
    resource_type: result.resource_type,
    format: result.format,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    secure_url: result.secure_url
  };
}

module.exports = {
  signedDownloadUrl,
  uploadBuffer,
  downloadBuffer,
  cloudinaryMetadata
};
