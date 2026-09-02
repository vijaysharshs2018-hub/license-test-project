const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8787;
const ADMIN_TOKEN =
  process.env.ADMIN_TOKEN || "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET";

const DB = path.join(__dirname, "licenses.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB, "utf8"));
  } catch {
    return { licenses: {} };
  }
}

function save(db) {
  fs.writeFileSync(DB, JSON.stringify(db, null, 2));
}

function json(res, code, obj) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  });

  res.end(JSON.stringify(obj));
}

function read(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function isActive(record) {
  if (!record) return false;
  if (record.status !== "active") return false;
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    return false;
  }

  return true;
}

function isAdmin(req) {
  return (
    req.headers["x-admin-token"] === ADMIN_TOKEN
  );
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      return json(res, 204, {});
    }

    const url = new URL(req.url, "http://x");
    const pathname = url.pathname;

    // Health check
    if (req.method === "GET" && pathname === "/health") {
      return json(res, 200, { ok: true });
    }

    const body = await read(req);
    const db = load();

    // =====================================================
    // VALIDATE LICENSE
    // =====================================================

    if (req.method === "POST" && pathname === "/validate") {
      const { licenseKey, deviceId } = body;

      if (!licenseKey || !deviceId) {
        return json(res, 400, {
          active: false,
          message: "License key and device ID required"
        });
      }

      const record = db.licenses[licenseKey];

      if (!isActive(record)) {
        return json(res, 403, {
          active: false,
          message: "License inactive or expired"
        });
      }

      // First activation: lock license to device
      if (!record.deviceId) {
        record.deviceId = deviceId;
        save(db);
      }

      // Another device trying to use same license
      if (record.deviceId !== deviceId) {
        return json(res, 403, {
          active: false,
          message: "License is already activated on another device"
        });
      }

      return json(res, 200, {
        active: true,
        expiresAt: record.expiresAt
      });
    }

    // =====================================================
    // ALL ADMIN ENDPOINTS REQUIRE ADMIN TOKEN
    // =====================================================

    if (pathname.startsWith("/admin/") && !isAdmin(req)) {
      return json(res, 401, {
        error: "Unauthorized"
      });
    }

    // =====================================================
    // CREATE LICENSE
    // =====================================================

    if (req.method === "POST" && pathname === "/admin/create") {
      const { licenseKey, expiresAt } = body;

      if (!licenseKey) {
        return json(res, 400, {
          error: "licenseKey required"
        });
      }

      if (db.licenses[licenseKey]) {
        return json(res, 400, {
          error: "License already exists"
        });
      }

      db.licenses[licenseKey] = {
        status: "active",
        expiresAt: expiresAt || null,
        deviceId: null,
        createdAt: new Date().toISOString()
      };

      save(db);

      return json(res, 200, {
        ok: true,
        license: db.licenses[licenseKey]
      });
    }

    // =====================================================
    // ACTIVATE / DEACTIVATE LICENSE
    // =====================================================

    if (req.method === "POST" && pathname === "/admin/status") {
      const { licenseKey, status } = body;

      if (!db.licenses[licenseKey]) {
        return json(res, 404, {
          error: "Not found"
        });
      }

      if (!["active", "inactive"].includes(status)) {
        return json(res, 400, {
          error: "Status must be active or inactive"
        });
      }

      db.licenses[licenseKey].status = status;

      save(db);

      return json(res, 200, {
        ok: true
      });
    }

    // =====================================================
    // EXTEND OR CHANGE EXPIRY
    // =====================================================

    if (req.method === "POST" && pathname === "/admin/extend") {
      const { licenseKey, expiresAt } = body;

      if (!db.licenses[licenseKey]) {
        return json(res, 404, {
          error: "Not found"
        });
      }

      db.licenses[licenseKey].expiresAt = expiresAt;

      save(db);

      return json(res, 200, {
        ok: true,
        expiresAt
      });
    }

    // =====================================================
    // RESET DEVICE
    // =====================================================

    if (req.method === "POST" && pathname === "/admin/reset-device") {
      const { licenseKey } = body;

      if (!db.licenses[licenseKey]) {
        return json(res, 404, {
          error: "Not found"
        });
      }

      db.licenses[licenseKey].deviceId = null;

      save(db);

      return json(res, 200, {
        ok: true,
        message: "Device reset successfully"
      });
    }

    // =====================================================
    // LIST ALL LICENSES
    // =====================================================

    if (req.method === "GET" && pathname === "/admin/list") {
      return json(res, 200, {
        licenses: db.licenses
      });
    }

    return json(res, 404, {
      error: "Not found"
    });

  } catch (error) {
    return json(res, 500, {
      error: error.message
    });
  }
});

server.listen(PORT, () => {
  console.log("License server listening on " + PORT);
});
