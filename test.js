console.log("Downloading google keys");
const resp = await fetch("https://www.googleapis.com/oauth2/v3/certs");
const jsonResp = await resp.json();
console.log("Google keys downloaded: ", jsonResp);
const keys = jsonResp.keys;

// parse the jwt
const decoded = jwt.decode(googleToken, { complete: true });
const header = decoded.header;
const kid = header.kid;
console.log("JWT parsed");

// find the key
const key = keys.find((k) => k.kid === kid);
console.log("Found key: ", key);

// convert the key so it can be used by the JWT library
delete key.alg;
const subtleImportedKey = await crypto.subtle.importKey(
  "jwk",
  key,
  { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  true,
  ["verify"]
);
const publicKey = await crypto.subtle.exportKey(
  "spki",
  subtleImportedKey.publicKey
);
let body = btoa(String.fromCharCode(...new Uint8Array(publicKey)));
body = body.match(/.{1,64}/g).join("\n");
const pemKey =
  "-----BEGIN PUBLIC KEY-----\n" + body + "\n-----END PUBLIC KEY-----";
console.log("Key converted");

const payload = jwt.verify(googleToken, pemKey, { algorithms: ["RS256"] });
console.log("JWT verified");
