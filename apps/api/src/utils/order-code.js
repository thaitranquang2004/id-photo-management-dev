function generateOrderCode(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const entropy = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${date}-${entropy}`;
}

module.exports = { generateOrderCode };
