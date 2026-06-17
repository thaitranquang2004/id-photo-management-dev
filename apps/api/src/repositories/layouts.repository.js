const { one, many } = require('../db/pool');

async function findById(id, client) {
  return one('select * from public.print_layouts where id = $1', [id], client);
}

async function getWithItems(id, client) {
  const printLayout = await findById(id, client);
  if (!printLayout) return null;
  const items = await many(
    `select pli.*, p.status as photo_status
     from public.print_layout_items pli
     join public.photos p on p.id = pli.photo_id
     where pli.layout_id = $1
     order by pli.position`,
    [id],
    client
  );
  return { print_layout: printLayout, items };
}

async function createLayout(data, actorId, client) {
  return one(
    `insert into public.print_layouts (
       order_id, created_by, layout_type, paper_size, dpi, add_text, status,
       cloudinary_public_id, layout_config, layout_asset_metadata, file_size_bytes, metadata
     )
     values ($1, $2, $3, $4, $5, $6, 'generated', $7, $8, $9, $10, $11)
     returning *`,
    [
      data.order_id,
      actorId,
      data.layout_type,
      data.paper_size,
      data.dpi || 300,
      data.add_text || false,
      data.cloudinary_public_id,
      data.layout_config || {},
      data.layout_asset_metadata || {},
      data.file_size_bytes || null,
      data.metadata || {}
    ],
    client
  );
}

async function createItems(layoutId, photoIds, client) {
  const values = photoIds.map((_, index) => `($1, $${index + 2}, ${index})`).join(', ');
  return many(
    `insert into public.print_layout_items (layout_id, photo_id, position)
     values ${values}
     returning *`,
    [layoutId, ...photoIds],
    client
  );
}

async function createIssue(layoutId, data, actorId, client) {
  return one(
    `insert into public.layout_issues (layout_id, issue_type, note, reported_by)
     values ($1, $2, $3, $4)
     returning *`,
    [layoutId, data.issue_type, data.note || null, actorId],
    client
  );
}

async function markNeedsFix(layoutId, client) {
  return one(
    `update public.print_layouts
     set status = 'needs_fix'
     where id = $1
     returning *`,
    [layoutId],
    client
  );
}

async function generatedByOrder(orderId, client) {
  return many(
    `select *
     from public.print_layouts
     where order_id = $1 and status = 'generated'
     order by created_at desc`,
    [orderId],
    client
  );
}

module.exports = {
  findById,
  getWithItems,
  createLayout,
  createItems,
  createIssue,
  markNeedsFix,
  generatedByOrder
};
