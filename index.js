const crypto = require('crypto');
const axios = require('axios');

// Function to generate MAC address with a given prefix
function generateMac(prefix) {
  const macSuffix = Array.from({ length: 3 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':');
  return `${prefix}:${macSuffix}`;
}

// Function to validate MAC address format and prefix
function validateMac(mac, deviceType) {
  const prefixes = {
    "iptv_app": "00:1B:79",
    "stb": "00:1A:79"
  };

  const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
  if (!mac.match(macRegex)) return false;

  const expectedPrefix = prefixes[deviceType];
  if (!expectedPrefix) throw new Error("Invalid device type. Use 'iptv_app' or 'stb'.");

  return mac.startsWith(expectedPrefix);
}

// Function to generate device ids based on MAC address
function device(mac) {
  mac = mac.toUpperCase();
  const SN = md5(mac);
  const SNCut = SN.slice(0, 13);
  const DEV = sha256(mac);
  const DEV1 = sha256(SNCut);
  const SG = `${SNCut}+${mac}`;
  const SING = sha256(SG);
  
  return { sn: SN, devid1: DEV, devid2: DEV1 };
}

// MD5 hash function (simple implementation)
function md5(input) {
  return crypto.createHash('md5').update(input).digest('hex').toUpperCase();
}

// SHA256 hash function (simple implementation)
function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex').toUpperCase();
}

// Create Vercel serverless function
module.exports = async (req, res) => {
  const deviceType = req.query.deviceType || 'stb'; // Default to 'stb'
  const mac = generateMac(deviceType === 'stb' ? '00:1A:79' : '00:1B:79'); // Generate MAC

  try {
    if (validateMac(mac, deviceType)) {
      const deviceInfo = device(mac);

      // Request to starshare.live
      const url = "http://starshare.live/server/load.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml";
      const headers = {
        "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
        "X-User-Agent": "Model: MAG250; Link: WiFi",
        "Referer": "http://starshare.live/c/",
        "Cookie": `mac=${mac}; stb_lang=en; timezone=GMT`,
        "Accept": "*/*",
        "Host": "starshare.live",
        "Connection": "Keep-Alive",
        "Accept-Encoding": "gzip"
      };

      try {
        // Make the request to starshare.live API
        const response = await axios.get(url, { headers });

        if (response.data && response.data.js && response.data.js.token) {
          const status = "Yes";
          const token = response.data.js.token;
          res.status(200).json({ status, mac, deviceInfo, token });
        } else {
          res.status(400).json({ status: "No", message: "Token not found in response." });
        }
      } catch (error) {
        res.status(500).json({ status: "Error", message: "Error fetching from starshare.live", error: error.message });
      }
    } else {
      res.status(400).json({ status: "No", message: "Invalid MAC address" });
    }
  } catch (error) {
    res.status(500).json({ status: "Error", message: error.message });
  }
};
