const { one, many } = require('../db/pool');

async function approvedPhotoForPublic(photoId, orderId, client) {
  return one(
    `select *
     from public.anh
     where id = $1 and don_hang_id = $2 and trang_thai = 'approved'`,
    [photoId, orderId],
    client
  );
}

async function approvedPhotos(orderId, client) {
  return many(
    `select *
     from public.anh
     where don_hang_id = $1 and trang_thai = 'approved'
     order by ngay_tao desc`,
    [orderId],
    client
  );
}

module.exports = {
  approvedPhotoForPublic,
  approvedPhotos
};
