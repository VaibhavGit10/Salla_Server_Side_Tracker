export function rawBodySaver(req, res, buf, encoding) {
  // buf is a Buffer (this is what we need for HMAC)
  req.rawBody = buf;
}
