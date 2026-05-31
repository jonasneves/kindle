var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};

// package/docs/signal/peer-key.js
var STORAGE_KEY = "signal:peer-key:v1";
var _keyPair = null;
var _pubkeyB64 = null;
var _loadPromise = null;
function _b64encode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function _b64decode(s) {
  const base = (s || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = base.length % 4 === 0 ? base : base + "=".repeat(4 - base.length % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function _loadOrCreate() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const privateKey = await crypto.subtle.importKey(
        "jwk",
        parsed.privateKey,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
      );
      const publicKey = await crypto.subtle.importKey(
        "jwk",
        parsed.publicKey,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"]
      );
      return { privateKey, publicKey };
    }
  } catch (e) {
  }
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  try {
    const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ privateKey: privateJwk, publicKey: publicJwk }));
  } catch (e) {
  }
  return pair;
}
async function getMyKeyPair() {
  if (_keyPair) return _keyPair;
  if (!_loadPromise) _loadPromise = _loadOrCreate();
  _keyPair = await _loadPromise;
  return _keyPair;
}
async function getMyPubkeyB64() {
  if (_pubkeyB64) return _pubkeyB64;
  const { publicKey } = await getMyKeyPair();
  const raw = await crypto.subtle.exportKey("raw", publicKey);
  _pubkeyB64 = _b64encode(raw);
  return _pubkeyB64;
}
async function signBytes(bytes) {
  const { privateKey } = await getMyKeyPair();
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    bytes
  );
  return _b64encode(sig);
}
async function verifyBytes(bytes, sigB64, pubkeyB64) {
  try {
    const raw = _b64decode(pubkeyB64);
    const pubkey = await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pubkey,
      _b64decode(sigB64),
      bytes
    );
  } catch (e) {
    return false;
  }
}
function canonical(obj) {
  if (obj === null || obj === void 0) return JSON.stringify(obj);
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonical).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") + "}";
}

// package/docs/signal/room-lobby.js
var DEFAULT_SIGNAL_URL = "https://signal.neevs.io";
var RECONNECT_BASE_MS = 1500;
var RECONNECT_MAX_MS = 3e4;
var HEARTBEAT_MS = 2e4;
var REPUBLISH_MS = 25e3;
var PRUNE_MS = 5e3;
async function _envelopeForPublish(id, data) {
  const pubkey = await getMyPubkeyB64();
  const bytes = new TextEncoder().encode(canonical({ id, data, pubkey }));
  const sig = await signBytes(bytes);
  return __spreadProps(__spreadValues({}, data), { _pubkey: pubkey, _sig: sig });
}
var _verifyCache = /* @__PURE__ */ new Map();
var VERIFY_CACHE_MAX = 256;
async function _verifyAd(ad) {
  const data = ad && ad.data;
  if (!data || !data._sig || !data._pubkey) return false;
  const cacheKey = ad.id + "|" + data._sig;
  if (_verifyCache.has(cacheKey)) return _verifyCache.get(cacheKey);
  const _a = data, { _sig, _pubkey } = _a, rest = __objRest(_a, ["_sig", "_pubkey"]);
  const bytes = new TextEncoder().encode(canonical({ id: ad.id, data: rest, pubkey: _pubkey }));
  const ok = await verifyBytes(bytes, _sig, _pubkey);
  if (_verifyCache.size >= VERIFY_CACHE_MAX) {
    _verifyCache.delete(_verifyCache.keys().next().value);
  }
  _verifyCache.set(cacheKey, ok);
  return ok;
}
var RoomLobbyClient = class {
  constructor(opts) {
    opts = opts || {};
    if (!opts.room || typeof opts.room !== "string") {
      throw new Error("roomLobby: { room } required");
    }
    const base = (opts.signalUrl || DEFAULT_SIGNAL_URL).replace(/^http/, "ws");
    this._url = base + "/" + encodeURIComponent(opts.room) + "/ws";
    this._sign = !!opts.sign;
    this._myPeerId = opts.peerId || "lobby-" + Math.random().toString(36).slice(2, 10);
    this._ws = null;
    this._listeners = /* @__PURE__ */ new Set();
    this._foreign = /* @__PURE__ */ new Map();
    this._myAds = /* @__PURE__ */ new Map();
    this._reconnectDelay = RECONNECT_BASE_MS;
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
    this._republishTimer = null;
    this._pruneTimer = setInterval(() => this._pruneAndNotify(), PRUNE_MS);
    this._closed = false;
    this._connect();
  }
  _connect() {
    if (this._closed) return;
    try {
      this._ws = new WebSocket(this._url);
    } catch (e) {
      this._scheduleReconnect();
      return;
    }
    this._ws.addEventListener("open", () => {
      this._reconnectDelay = RECONNECT_BASE_MS;
      for (const [id, payload] of this._myAds) {
        this._sendPublish(id, payload.data, payload.ttl);
      }
      this._startHeartbeat();
      this._startRepublish();
    });
    this._ws.addEventListener("message", (e) => this._onMessage(e));
    this._ws.addEventListener("close", () => {
      this._stopHeartbeat();
      this._stopRepublish();
      this._scheduleReconnect();
    });
    this._ws.addEventListener("error", () => {
    });
  }
  async _onMessage(e) {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch (e2) {
      return;
    }
    if (msg.type !== "signal") return;
    const peerId = msg.peer;
    if (!peerId || peerId === this._myPeerId) return;
    const d = msg.data;
    if (!d || typeof d !== "object") return;
    if (d.kind === "lobby-ad") {
      if (!d.id) return;
      if (this._sign && !await _verifyAd({ id: d.id, data: d.data })) return;
      let table = this._foreign.get(peerId);
      if (!table) {
        table = /* @__PURE__ */ new Map();
        this._foreign.set(peerId, table);
      }
      const expiresAt = d.ttl ? Date.now() + d.ttl : 0;
      table.set(d.id, { data: d.data, expiresAt });
      this._notify();
    } else if (d.kind === "lobby-remove") {
      const table = this._foreign.get(peerId);
      if (!table) return;
      table.delete(d.id);
      if (table.size === 0) this._foreign.delete(peerId);
      this._notify();
    }
  }
  _scheduleReconnect() {
    if (this._closed) return;
    if (this._reconnectTimer) return;
    const delay = this._reconnectDelay + Math.random() * 1e3;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._reconnectDelay = Math.min(this._reconnectDelay * 2, RECONNECT_MAX_MS);
      this._connect();
    }, delay);
  }
  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this._ws && this._ws.readyState === 1) {
        try {
          this._ws.send(JSON.stringify({ type: "ping" }));
        } catch (e) {
        }
      }
    }, HEARTBEAT_MS);
  }
  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }
  _startRepublish() {
    this._stopRepublish();
    this._republishTimer = setInterval(() => {
      if (!this._ws || this._ws.readyState !== 1) return;
      for (const [id, payload] of this._myAds) {
        this._sendPublish(id, payload.data, payload.ttl);
      }
    }, REPUBLISH_MS);
  }
  _stopRepublish() {
    if (this._republishTimer) {
      clearInterval(this._republishTimer);
      this._republishTimer = null;
    }
  }
  async _sendPublish(id, data, ttl) {
    if (!this._ws || this._ws.readyState !== 1) return;
    let payload = data;
    if (this._sign) {
      try {
        payload = await _envelopeForPublish(id, data);
      } catch (e) {
        return;
      }
      if (!this._ws || this._ws.readyState !== 1) return;
    }
    try {
      this._ws.send(JSON.stringify({
        type: "signal",
        peer: this._myPeerId,
        data: { kind: "lobby-ad", id, data: payload, ttl }
      }));
    } catch (e) {
    }
  }
  _pruneAndNotify() {
    const now = Date.now();
    let dirty = false;
    for (const [peerId, table] of this._foreign) {
      for (const [id, ad] of table) {
        if (ad.expiresAt && ad.expiresAt < now) {
          table.delete(id);
          dirty = true;
        }
      }
      if (table.size === 0) this._foreign.delete(peerId);
    }
    for (const [id, ad] of this._myAds) {
      if (ad.expiresAt && ad.expiresAt < now) {
        this._myAds.delete(id);
        dirty = true;
      }
    }
    if (dirty) this._notify();
  }
  _ads() {
    const out = [];
    for (const [id, ad] of this._myAds) out.push({ id, data: ad.data });
    for (const table of this._foreign.values()) {
      for (const [id, ad] of table) out.push({ id, data: ad.data });
    }
    return out;
  }
  _notify() {
    const ads = this._ads();
    for (const fn of this._listeners) {
      try {
        fn(ads);
      } catch (e) {
      }
    }
  }
  // ── Public API (matches discover.js) ───────────────────────────────
  publish(id, data, ttlMs) {
    const expiresAt = ttlMs ? Date.now() + ttlMs : 0;
    this._myAds.set(id, { data, ttl: ttlMs, expiresAt });
    this._sendPublish(id, data, ttlMs);
    this._notify();
  }
  remove(id) {
    if (!this._myAds.has(id)) return;
    this._myAds.delete(id);
    if (this._ws && this._ws.readyState === 1) {
      try {
        this._ws.send(JSON.stringify({
          type: "signal",
          peer: this._myPeerId,
          data: { kind: "lobby-remove", id }
        }));
      } catch (e) {
      }
    }
    this._notify();
  }
  onChange(cb) {
    this._listeners.add(cb);
    try {
      cb(this._ads());
    } catch (e) {
    }
    return () => this._listeners.delete(cb);
  }
  ads() {
    return this._ads();
  }
  close() {
    this._closed = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._stopHeartbeat();
    this._stopRepublish();
    if (this._pruneTimer) {
      clearInterval(this._pruneTimer);
      this._pruneTimer = null;
    }
    if (this._ws) {
      try {
        this._ws.close();
      } catch (e) {
      }
      this._ws = null;
    }
    this._listeners.clear();
    this._foreign.clear();
    this._myAds.clear();
  }
};
function roomLobby(opts) {
  return new RoomLobbyClient(opts);
}

// package/docs/signal/discover.js
var DEFAULT_SIGNAL_URL2 = "https://signal.neevs.io";
var RECONNECT_BASE_MS2 = 1500;
var RECONNECT_MAX_MS2 = 3e4;
var HEARTBEAT_MS2 = 2e4;
var REPUBLISH_MS2 = 25e3;
async function _envelopeForPublish2(id, data) {
  const pubkey = await getMyPubkeyB64();
  const bytes = new TextEncoder().encode(canonical({ id, data, pubkey }));
  const sig = await signBytes(bytes);
  return __spreadProps(__spreadValues({}, data), { _pubkey: pubkey, _sig: sig });
}
var _verifyCache2 = /* @__PURE__ */ new Map();
var VERIFY_CACHE_MAX2 = 256;
async function _verifyAd2(ad) {
  const data = ad && ad.data;
  if (!data || !data._sig || !data._pubkey) return false;
  const cacheKey = ad.id + "|" + data._sig;
  if (_verifyCache2.has(cacheKey)) return _verifyCache2.get(cacheKey);
  const _a = data, { _sig, _pubkey } = _a, rest = __objRest(_a, ["_sig", "_pubkey"]);
  const bytes = new TextEncoder().encode(canonical({ id: ad.id, data: rest, pubkey: _pubkey }));
  const ok = await verifyBytes(bytes, _sig, _pubkey);
  if (_verifyCache2.size >= VERIFY_CACHE_MAX2) {
    _verifyCache2.delete(_verifyCache2.keys().next().value);
  }
  _verifyCache2.set(cacheKey, ok);
  return ok;
}
var DiscoveryClient = class {
  constructor(opts) {
    opts = opts || {};
    const base = (opts.signalUrl || DEFAULT_SIGNAL_URL2).replace(/^http/, "ws");
    this._url = base + "/discover/ws";
    this._sign = !!opts.sign;
    this._ws = null;
    this._ads = [];
    this._listeners = /* @__PURE__ */ new Set();
    this._myAds = /* @__PURE__ */ new Map();
    this._reconnectDelay = RECONNECT_BASE_MS2;
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
    this._republishTimer = null;
    this._closed = false;
    this._connect();
  }
  _connect() {
    if (this._closed) return;
    try {
      this._ws = new WebSocket(this._url);
    } catch (err) {
      this._scheduleReconnect();
      return;
    }
    this._ws.addEventListener("open", () => {
      this._reconnectDelay = RECONNECT_BASE_MS2;
      for (const [id, payload] of this._myAds) {
        this._sendPublish(id, payload.data, payload.ttl);
      }
      this._startHeartbeat();
      this._startRepublish();
    });
    this._ws.addEventListener("message", async (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch (e2) {
        return;
      }
      if (msg.type !== "ads") return;
      const raw = Array.isArray(msg.ads) ? msg.ads : [];
      let ads = raw;
      if (this._sign) {
        const checks = await Promise.all(raw.map(_verifyAd2));
        ads = raw.filter((_, i) => checks[i]);
      }
      this._ads = ads;
      for (const fn of this._listeners) {
        try {
          fn(this._ads);
        } catch (e2) {
        }
      }
    });
    this._ws.addEventListener("close", () => {
      this._stopHeartbeat();
      this._stopRepublish();
      this._scheduleReconnect();
    });
    this._ws.addEventListener("error", () => {
    });
  }
  _scheduleReconnect() {
    if (this._closed) return;
    if (this._reconnectTimer) return;
    const delay = this._reconnectDelay + Math.random() * 1e3;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._reconnectDelay = Math.min(this._reconnectDelay * 2, RECONNECT_MAX_MS2);
      this._connect();
    }, delay);
  }
  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this._ws && this._ws.readyState === 1) {
        try {
          this._ws.send(JSON.stringify({ type: "ping" }));
        } catch (e) {
        }
      }
    }, HEARTBEAT_MS2);
  }
  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }
  _startRepublish() {
    this._stopRepublish();
    this._republishTimer = setInterval(() => {
      if (!this._ws || this._ws.readyState !== 1) return;
      for (const [id, payload] of this._myAds) {
        this._sendPublish(id, payload.data, payload.ttl);
      }
    }, REPUBLISH_MS2);
  }
  _stopRepublish() {
    if (this._republishTimer) {
      clearInterval(this._republishTimer);
      this._republishTimer = null;
    }
  }
  async _sendPublish(id, data, ttl) {
    if (!this._ws || this._ws.readyState !== 1) return;
    let payload = data;
    if (this._sign) {
      try {
        payload = await _envelopeForPublish2(id, data);
      } catch (e) {
        return;
      }
      if (!this._ws || this._ws.readyState !== 1) return;
    }
    try {
      this._ws.send(JSON.stringify({ type: "publish", id, data: payload, ttl }));
    } catch (e) {
    }
  }
  // ── Public API ────────────────────────────────────────────────
  publish(id, data, ttlMs) {
    this._myAds.set(id, { data, ttl: ttlMs });
    this._sendPublish(id, data, ttlMs);
  }
  remove(id) {
    this._myAds.delete(id);
    if (this._ws && this._ws.readyState === 1) {
      try {
        this._ws.send(JSON.stringify({ type: "remove", id }));
      } catch (e) {
      }
    }
  }
  // Subscribe to ad-set changes. Fires immediately with the current snapshot.
  onChange(cb) {
    this._listeners.add(cb);
    try {
      cb(this._ads);
    } catch (e) {
    }
    return () => this._listeners.delete(cb);
  }
  ads() {
    return this._ads.slice();
  }
  close() {
    this._closed = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._stopHeartbeat();
    this._stopRepublish();
    if (this._ws) {
      try {
        this._ws.close();
      } catch (e) {
      }
      this._ws = null;
    }
    this._listeners.clear();
    this._myAds.clear();
  }
};
function discover(opts) {
  return new DiscoveryClient(opts);
}

// package/docs/signal/pair-request.js
var DEFAULT_REQUEST_TTL_MS = 3e4;
var DEFAULT_RESPONSE_TTL_MS = 3e4;
var DEFAULT_TIMEOUT_MS = 3e4;
var MAX_HANDLED_NONCES = 1e3;
function pairRequestClient({ app, sign = true, lobby = null } = {}) {
  if (!app || typeof app !== "string") {
    throw new Error("pairRequestClient: app namespace required");
  }
  const REQUEST_APP = app + "-request";
  const RESPONSE_APP = app + "-response";
  let _lobby = lobby;
  function _getLobby() {
    return _lobby || (_lobby = discover({ sign }));
  }
  let _myPubkey = null;
  async function _ensureMyPubkey() {
    if (!_myPubkey) _myPubkey = await getMyPubkeyB64();
    return _myPubkey;
  }
  const _pendingInitiations = /* @__PURE__ */ new Map();
  const _handledInboundNonces = /* @__PURE__ */ new Set();
  const _handledInboundOrder = [];
  function _markHandled(nonce) {
    if (_handledInboundNonces.has(nonce)) return;
    _handledInboundNonces.add(nonce);
    _handledInboundOrder.push(nonce);
    if (_handledInboundOrder.length > MAX_HANDLED_NONCES) {
      const drop = _handledInboundOrder.splice(0, MAX_HANDLED_NONCES / 2);
      for (const n of drop) _handledInboundNonces.delete(n);
    }
  }
  let _matchFn = null;
  let _handlerFn = null;
  let _errorFn = null;
  let _subscriptionActive = false;
  function _ensureSubscription() {
    if (_subscriptionActive) return;
    _subscriptionActive = true;
    _getLobby().onChange((ads) => {
      for (const ad of ads || []) {
        const d = ad.data;
        if (!d) continue;
        if (d.app === RESPONSE_APP) _dispatchResponse(ad);
        else if (d.app === REQUEST_APP) _dispatchRequest(ad);
      }
    });
  }
  function _dispatchResponse(ad) {
    const d = ad.data;
    if (!_myPubkey) return;
    if (d.target !== _myPubkey) return;
    const pending = _pendingInitiations.get(d.nonce);
    if (!pending) return;
    _pendingInitiations.delete(d.nonce);
    clearTimeout(pending.timer);
    try {
      _getLobby().remove(REQUEST_APP + ":" + d.nonce);
    } catch (e) {
    }
    const _a2 = d, { accepted, target: _t, nonce: _n, app: _a } = _a2, rest = __objRest(_a2, ["accepted", "target", "nonce", "app"]);
    if (accepted) pending.resolve({ accepted: true, data: rest });
    else pending.resolve({ accepted: false, reason: "denied", data: rest });
  }
  function _dispatchRequest(ad) {
    const d = ad.data;
    if (!_handlerFn) return;
    if (!d.nonce || _handledInboundNonces.has(d.nonce)) return;
    if (_matchFn && !_matchFn(ad)) return;
    _markHandled(d.nonce);
    const senderPubkey = d._pubkey || null;
    const _a2 = d, { app: _a, nonce: _n, _pubkey: _p, _sig: _s } = _a2, payload = __objRest(_a2, ["app", "nonce", "_pubkey", "_sig"]);
    const req = {
      senderPubkey,
      payload,
      accept: (responsePayload = {}) => _publishResponse(true, senderPubkey, d.nonce, responsePayload),
      deny: (responsePayload = {}) => _publishResponse(false, senderPubkey, d.nonce, responsePayload)
    };
    Promise.resolve().then(() => _handlerFn(req)).catch((err) => {
      try {
        _publishResponse(false, senderPubkey, d.nonce, { reason: "error" });
      } catch (e) {
      }
      if (_errorFn) {
        try {
          _errorFn(err, req);
        } catch (e) {
        }
      }
      throw err;
    });
  }
  function _publishResponse(accepted, targetPubkey, nonce, payload) {
    const data = __spreadValues({
      app: RESPONSE_APP,
      target: targetPubkey,
      nonce,
      accepted: !!accepted
    }, payload);
    return _getLobby().publish(RESPONSE_APP + ":" + nonce, data, DEFAULT_RESPONSE_TTL_MS);
  }
  async function request({ payload = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    await _ensureMyPubkey();
    _ensureSubscription();
    const nonce = crypto.randomUUID && crypto.randomUUID() || Math.random().toString(36).slice(2);
    const p = new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!_pendingInitiations.has(nonce)) return;
        _pendingInitiations.delete(nonce);
        try {
          _getLobby().remove(REQUEST_APP + ":" + nonce);
        } catch (e) {
        }
        resolve({ accepted: false, reason: "timeout", timedOut: true });
      }, timeoutMs);
      _pendingInitiations.set(nonce, { resolve, timer });
    });
    try {
      await _getLobby().publish(REQUEST_APP + ":" + nonce, __spreadValues({
        app: REQUEST_APP,
        nonce
      }, payload), DEFAULT_REQUEST_TTL_MS);
    } catch (err) {
      const pending = _pendingInitiations.get(nonce);
      if (pending) {
        _pendingInitiations.delete(nonce);
        clearTimeout(pending.timer);
        pending.resolve({ accepted: false, reason: "error", error: err });
      }
    }
    return p;
  }
  function onRequest(handler, { match = null, onError = null } = {}) {
    _ensureMyPubkey().catch(() => {
    });
    _matchFn = match;
    _handlerFn = handler;
    _errorFn = onError;
    _ensureSubscription();
  }
  return { request, onRequest };
}

// package/docs/transport.esm.js
var SIGNAL_BASE = "https://signal.neevs.io";
var TURN_ENDPOINT = "https://proxy.neevs.io/cloudflare/turn";
var STUN_FALLBACK = [{ urls: "stun:stun.cloudflare.com:3478" }];
var DEFAULT_LOBBY_NAMESPACE = "pip-relay";
var DEFAULT_PAIR_TIMEOUT_MS = 3e4;
var DEFAULT_DC_OPEN_TIMEOUT_MS = 3e4;
async function fetchIceServers() {
  try {
    const r = await fetch(TURN_ENDPOINT, { method: "POST" });
    if (!r.ok) throw new Error(`turn: ${r.status}`);
    const { iceServers } = await r.json();
    return [...STUN_FALLBACK, ...iceServers];
  } catch (e) {
    return STUN_FALLBACK;
  }
}
function openRoomWs(room, myPeerId, signalUrl = SIGNAL_BASE) {
  const url = signalUrl.replace(/^http/, "ws") + "/" + encodeURIComponent(room) + "/ws";
  const ws = new WebSocket(url);
  const listeners = /* @__PURE__ */ new Set();
  const buffered = [];
  let resolveOpen;
  const opened = new Promise((r) => {
    resolveOpen = r;
  });
  ws.addEventListener("open", () => {
    while (buffered.length) {
      try {
        ws.send(buffered.shift());
      } catch (e) {
      }
    }
    resolveOpen();
  });
  ws.addEventListener("message", (e) => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch (e2) {
      return;
    }
    if (msg.type !== "signal") return;
    if (msg.peer === myPeerId) return;
    for (const fn of listeners) {
      try {
        fn(msg);
      } catch (err) {
        console.warn("[transport] ws listener", err);
      }
    }
  });
  return {
    opened,
    on(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    send(data) {
      const frame = JSON.stringify({ type: "signal", peer: myPeerId, data });
      if (ws.readyState === 1) {
        try {
          ws.send(frame);
        } catch (e) {
        }
      } else {
        buffered.push(frame);
      }
    },
    close() {
      listeners.clear();
      try {
        ws.close();
      } catch (e) {
      }
    }
  };
}
async function join({
  siteId,
  lobbyNamespace = DEFAULT_LOBBY_NAMESPACE,
  signalUrl = SIGNAL_BASE,
  pairTimeoutMs = DEFAULT_PAIR_TIMEOUT_MS,
  dcOpenTimeoutMs = DEFAULT_DC_OPEN_TIMEOUT_MS
} = {}) {
  var _a;
  if (!siteId) throw new Error("join: { siteId } is required");
  const lobbyRoom = `${lobbyNamespace}:${siteId}`;
  const lobby = roomLobby({ room: lobbyRoom, signalUrl, sign: true });
  const pr = pairRequestClient({ app: lobbyNamespace, lobby, sign: true });
  let result;
  try {
    result = await pr.request({
      payload: { kind: "visitor-hello" },
      timeoutMs: pairTimeoutMs
    });
  } finally {
    lobby.close();
  }
  if (!result.accepted) {
    throw new Error(`pair-request: ${result.reason || "unknown"}`);
  }
  const ephemeralRoom = (_a = result.data) == null ? void 0 : _a.room;
  if (!ephemeralRoom) throw new Error("pair-request: response missing room");
  const myPeerId = "visitor-" + Math.random().toString(36).slice(2, 8);
  const ws = openRoomWs(ephemeralRoom, myPeerId, signalUrl);
  const iceServers = await fetchIceServers();
  const pc = new RTCPeerConnection({ iceServers });
  const dc = pc.createDataChannel("pip-relay");
  pc.onicecandidate = (e) => {
    if (e.candidate) ws.send({ ice: e.candidate });
  };
  ws.on(async (msg) => {
    var _a2, _b;
    if ((_a2 = msg.data) == null ? void 0 : _a2.answer) {
      try {
        await pc.setRemoteDescription(msg.data.answer);
      } catch (err) {
        console.warn("[transport] setRemoteDescription", err);
      }
    } else if ((_b = msg.data) == null ? void 0 : _b.ice) {
      try {
        await pc.addIceCandidate(msg.data.ice);
      } catch (e) {
      }
    }
  });
  await ws.opened;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send({ offer });
  return wrapSession({ pc, dc, ws, dcOpenTimeoutMs });
}
function host({
  siteId,
  lobbyNamespace = DEFAULT_LOBBY_NAMESPACE,
  signalUrl = SIGNAL_BASE,
  dcOpenTimeoutMs = DEFAULT_DC_OPEN_TIMEOUT_MS
} = {}) {
  if (!siteId) throw new Error("host: { siteId } is required");
  const lobbyRoom = `${lobbyNamespace}:${siteId}`;
  const lobby = roomLobby({ room: lobbyRoom, signalUrl, sign: true });
  const pr = pairRequestClient({ app: lobbyNamespace, lobby, sign: true });
  const sessionListeners = /* @__PURE__ */ new Set();
  const errorListeners = /* @__PURE__ */ new Set();
  const sessions = /* @__PURE__ */ new Set();
  let closed = false;
  pr.onRequest(async (req) => {
    var _a;
    if (closed) return;
    if (((_a = req.payload) == null ? void 0 : _a.kind) !== "visitor-hello") {
      await req.deny({ reason: "unknown kind" });
      return;
    }
    const ephemeralRoom = `pip-relay-session-${crypto.randomUUID()}`;
    const myPeerId = "host-" + Math.random().toString(36).slice(2, 8);
    await req.accept({ room: ephemeralRoom, hostPeerId: myPeerId });
    const ws = openRoomWs(ephemeralRoom, myPeerId, signalUrl);
    const iceServers = await fetchIceServers();
    const pc = new RTCPeerConnection({ iceServers });
    pc.onicecandidate = (e) => {
      if (e.candidate) ws.send({ ice: e.candidate });
    };
    pc.ondatachannel = (e) => {
      const session = wrapSession({ pc, dc: e.channel, ws, dcOpenTimeoutMs, visitorPubkey: req.senderPubkey });
      sessions.add(session);
      session.onClose(() => sessions.delete(session));
      for (const fn of sessionListeners) {
        try {
          fn(session);
        } catch (err) {
          console.warn("[transport] session listener", err);
        }
      }
    };
    ws.on(async (msg) => {
      var _a2, _b;
      try {
        if ((_a2 = msg.data) == null ? void 0 : _a2.offer) {
          await pc.setRemoteDescription(msg.data.offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send({ answer });
        } else if ((_b = msg.data) == null ? void 0 : _b.ice) {
          try {
            await pc.addIceCandidate(msg.data.ice);
          } catch (e) {
          }
        }
      } catch (err) {
        for (const fn of errorListeners) {
          try {
            fn(err);
          } catch (e) {
          }
        }
      }
    });
  });
  return {
    onSession(cb) {
      sessionListeners.add(cb);
      return () => sessionListeners.delete(cb);
    },
    onError(cb) {
      errorListeners.add(cb);
      return () => errorListeners.delete(cb);
    },
    sessions: () => [...sessions],
    close() {
      if (closed) return;
      closed = true;
      lobby.close();
      for (const s of sessions) s.close();
    }
  };
}
function wrapSession({ pc, dc, ws, dcOpenTimeoutMs, visitorPubkey = null }) {
  const messageListeners = /* @__PURE__ */ new Set();
  const closeListeners = /* @__PURE__ */ new Set();
  let closed = false;
  const ready = new Promise((resolve, reject) => {
    if (dc.readyState === "open") {
      resolve();
      return;
    }
    const timer = setTimeout(() => reject(new Error("data channel open timeout")), dcOpenTimeoutMs);
    dc.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    dc.addEventListener("error", (e) => {
      clearTimeout(timer);
      reject(e);
    }, { once: true });
  });
  dc.addEventListener("message", (e) => {
    let payload;
    try {
      payload = JSON.parse(e.data);
    } catch (e2) {
      payload = { kind: "text", text: String(e.data) };
    }
    for (const fn of messageListeners) {
      try {
        fn(payload);
      } catch (err) {
        console.warn("[transport] message listener", err);
      }
    }
  });
  function close() {
    if (closed) return;
    closed = true;
    try {
      dc.close();
    } catch (e) {
    }
    try {
      pc.close();
    } catch (e) {
    }
    try {
      ws.close();
    } catch (e) {
    }
    for (const fn of closeListeners) {
      try {
        fn();
      } catch (e) {
      }
    }
  }
  pc.addEventListener("connectionstatechange", () => {
    if (["failed", "closed", "disconnected"].includes(pc.connectionState)) close();
  });
  return {
    ready,
    visitorPubkey,
    send(msg) {
      if (closed || dc.readyState !== "open") return false;
      const payload = typeof msg === "string" ? msg : JSON.stringify(msg);
      try {
        dc.send(payload);
        return true;
      } catch (e) {
        return false;
      }
    },
    onMessage(cb) {
      messageListeners.add(cb);
      return () => messageListeners.delete(cb);
    },
    onClose(cb) {
      closeListeners.add(cb);
      return () => closeListeners.delete(cb);
    },
    close
  };
}
export {
  fetchIceServers,
  host,
  join
};
