import CryptoJS from "crypto-js";

const SECRET = process.env.ENCRYPTION_KEY;

if (!SECRET) {
  throw new Error("ENCRYPTION_KEY missing");
}

export function encrypt(value) {
  return CryptoJS.AES.encrypt(value, SECRET).toString();
}

export function decrypt(value) {
  const bytes = CryptoJS.AES.decrypt(value, SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
}
