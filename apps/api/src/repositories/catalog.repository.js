const { one, many } = require('../db/pool');

async function listCardTypes(client) {
  return many(
    `select ct.*,
            p.id as current_pricing_id,
            p.price_per_copy as current_price_per_copy,
            p.processing_fee as current_processing_fee
     from public.card_types ct
     left join lateral (
       select *
       from public.pricing p
       where p.card_type_id = ct.id
         and p.effective_from <= current_date
         and (p.effective_to is null or p.effective_to >= current_date)
       order by p.effective_from desc
       limit 1
     ) p on true
     where ct.is_active = true
     order by ct.display_order, ct.name`,
    [],
    client
  );
}

async function findCardType(id, client) {
  return one('select * from public.card_types where id = $1', [id], client);
}

async function createCardType(data, client) {
  return one(
    `insert into public.card_types (
       name, short_code, width_mm, height_mm, background_color, requirements, display_order
     )
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      data.name,
      data.short_code,
      data.width_mm,
      data.height_mm,
      data.background_color,
      data.requirements || {},
      data.display_order || 0
    ],
    client
  );
}

async function updateCardType(id, patch, client) {
  return one(
    `update public.card_types
     set name = coalesce($2, name),
         short_code = coalesce($3, short_code),
         width_mm = coalesce($4, width_mm),
         height_mm = coalesce($5, height_mm),
         background_color = coalesce($6, background_color),
         requirements = coalesce($7, requirements),
         display_order = coalesce($8, display_order),
         updated_at = now()
     where id = $1
     returning *`,
    [
      id,
      patch.name ?? null,
      patch.short_code ?? null,
      patch.width_mm ?? null,
      patch.height_mm ?? null,
      patch.background_color ?? null,
      patch.requirements ?? null,
      patch.display_order ?? null
    ],
    client
  );
}

async function archiveCardType(id, client) {
  return one(
    `update public.card_types
     set is_active = false,
         archived_at = now(),
         updated_at = now()
     where id = $1
     returning *`,
    [id],
    client
  );
}

async function listPricing(cardTypeId, client) {
  return many(
    `select *
     from public.pricing
     where ($1::uuid is null or card_type_id = $1)
     order by card_type_id, effective_from desc`,
    [cardTypeId || null],
    client
  );
}

async function lockPricingForCardType(cardTypeId, client) {
  return many(
    `select *
     from public.pricing
     where card_type_id = $1
     order by effective_from
     for update`,
    [cardTypeId],
    client
  );
}

async function getCurrentPricing(cardTypeId, effectiveDate, client) {
  return one(
    `select p.*, ct.name as card_type_name, ct.width_mm, ct.height_mm, ct.background_color
     from public.pricing p
     join public.card_types ct on ct.id = p.card_type_id
     where p.card_type_id = $1
       and p.effective_from <= $2::date
       and (p.effective_to is null or p.effective_to >= $2::date)
     order by p.effective_from desc
     limit 1`,
    [cardTypeId, effectiveDate],
    client
  );
}

async function closeOpenPricing(cardTypeId, effectiveTo, client) {
  return many(
    `update public.pricing
     set effective_to = $2::date
     where card_type_id = $1
       and effective_to is null
       and effective_from <= $2::date
     returning *`,
    [cardTypeId, effectiveTo],
    client
  );
}

async function insertPricing(data, actorId, client) {
  return one(
    `insert into public.pricing (
       card_type_id, price_per_copy, processing_fee, effective_from, effective_to, created_by
     )
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      data.card_type_id,
      data.price_per_copy,
      data.processing_fee,
      data.effective_from,
      data.effective_to || null,
      actorId
    ],
    client
  );
}

module.exports = {
  listCardTypes,
  findCardType,
  createCardType,
  updateCardType,
  archiveCardType,
  listPricing,
  lockPricingForCardType,
  getCurrentPricing,
  closeOpenPricing,
  insertPricing
};
