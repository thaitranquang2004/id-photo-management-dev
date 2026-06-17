# API Verification Notes

Base URL: `http://localhost:4000/api/v1`

Verified on: `2026-06-17`

## Smoke checks

```sh
curl -s http://localhost:4000/api/v1/health
```

Expected:

```json
{"success":true,"data":{"status":"ok"},"pagination":null}
```

Actual result: `200 OK` with required success envelope.

## Auth checks

Missing JWT on Staff/Admin endpoint:

```sh
curl -i http://localhost:4000/api/v1/orders
```

Expected: `401` with `error.code = "UNAUTHORIZED"`.

Actual result: `401 UNAUTHORIZED`.

Admin endpoint with a valid staff JWT:

```sh
curl -i -H "Authorization: Bearer <staff_jwt>" http://localhost:4000/api/v1/admin/dashboard
```

Expected: `403` with `error.code = "FORBIDDEN"`.

Actual result: covered by `node --test` middleware test because no real staff JWT is available in local Auth.

## Core business checks

Create order:

```sh
curl -s -X POST http://localhost:4000/api/v1/orders \
  -H "Authorization: Bearer <staff_or_admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"<uuid>","card_type_id":"<uuid>","quantity":1}'
```

Expected:

- `order.order_code` starts with `ORD-`.
- `pricing_snapshot` is created.
- `order.total_amount` equals the current pricing calculation.

Actual service-layer result against local seed:

```json
{
  "order_code": "ORD-20260617-N6LPKQ",
  "total_amount": "100000.00",
  "quantity": 2,
  "snapshot_total": "100000.00"
}
```

Invalid transition:

```sh
curl -s -X POST http://localhost:4000/api/v1/orders/<pending_order_id>/deliver \
  -H "Authorization: Bearer <staff_or_admin_jwt>"
```

Expected: `409` with `error.code = "INVALID_STATE_TRANSITION"`.

Actual service-layer result: `INVALID_STATE_TRANSITION` for `pending -> delivered`.

Pricing overlap:

```sh
node -e "require('./src/services/catalog.service').createPricing(...)"
```

Actual service-layer result: `VALIDATION_ERROR` with `overlapping_pricing_id`.

Public rate limit:

```sh
for i in 1 2 3; do
  curl -s "http://localhost:4000/api/v1/public/customer-lookup?phone=0901234567&order_code=ORD-NOTFOUND"
done
```

Expected: requests over `PUBLIC_LOOKUP_RATE_LIMIT_MAX` return `429` with `RATE_LIMITED`.

Actual result with `PUBLIC_LOOKUP_RATE_LIMIT_MAX=2`: third request returned `RATE_LIMITED`.

## Skeleton/integration-dependent endpoints

These routes are wired and validated, but require Cloudinary/render/upload integration to return real URLs or files:

- `POST /photos` with multipart `files[]`.
- `POST /layouts/preview`.
- `POST /layouts/generate` unless caller provides a real `cloudinary_public_id`.
- `POST /layouts/:id/download-url`.
- `POST /public/photos/:id/download-url`.
