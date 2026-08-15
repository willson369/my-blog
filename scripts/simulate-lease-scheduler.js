/* eslint-disable */
'use strict';

/**
 * Multi-node lease scheduler simulation (no extra project directory).
 *
 * Models the enterprise design:
 * - Caffeine-like local TTL cache + Redis-like shared cache
 * - Redisson-like distributed lock (SET NX PX + token unlock)
 * - MySQL optimistic lock (version CAS)
 * - RabbitMQ delayed queue (scheduled delivery + expire billing/reset)
 *
 * Usage: node scripts/simulate-lease-scheduler.js
 */

const http = require('http');
const { fork } = require('child_process');
const { randomUUID } = require('crypto');
const { performance } = require('perf_hooks');

const ROLE = process.argv[2];
const COORDINATOR_PORT = Number(process.env.LEASE_SIM_PORT || 0);
const NODE_COUNT = 4;
const REQUESTS_PER_NODE = 40;
const SLOT_ID = 'gpu-a100-slot-2026-08-15T10:00';
const LOCK_KEY = `lease:${SLOT_ID}`;
const HOT_LOCAL_TTL_MS = 300;
const HOT_REDIS_TTL_MS = 800;
const DELAY_TARGETS_MS = [300, 600, 1200];
const DELAY_TOLERANCE_MS = 80;

if (ROLE === '--worker') {
	runWorker().catch((err) => {
		console.error(err);
		process.exit(1);
	});
} else {
	runCoordinator().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowMs() {
	return performance.now();
}

function json(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		'Content-Type': 'application/json',
		'Content-Length': Buffer.byteLength(payload)
	});
	res.end(payload);
}

async function readBody(req) {
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	if (!chunks.length) return {};
	return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function rpc(port, pathname, body) {
	const payload = JSON.stringify(body ?? {});
	return new Promise((resolve, reject) => {
		const req = http.request(
			{
				hostname: '127.0.0.1',
				port,
				path: pathname,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(payload)
				}
			},
			(res) => {
				const chunks = [];
				res.on('data', (c) => chunks.push(c));
				res.on('end', () => {
					try {
						resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
					} catch (err) {
						reject(err);
					}
				});
			}
		);
		req.on('error', reject);
		req.write(payload);
		req.end();
	});
}

function createStore() {
	return {
		redisKv: new Map(),
		locks: new Map(),
		slot: {
			id: SLOT_ID,
			deviceId: 'gpu-a100-01',
			status: 'AVAILABLE',
			version: 1,
			tenantId: null,
			billed: false,
			billAmount: 0,
			resetCount: 0
		},
		delayQueue: [],
		metrics: {
			lockAcquired: 0,
			lockRejected: 0,
			casSuccess: 0,
			casConflict: 0,
			expireFired: 0,
			expireDuplicateIgnored: 0,
			cacheRedisSet: 0,
			cacheRedisHit: 0
		}
	};
}

function redisGet(store, key) {
	const row = store.redisKv.get(key);
	if (!row) return null;
	if (row.expireAt <= Date.now()) {
		store.redisKv.delete(key);
		return null;
	}
	store.metrics.cacheRedisHit += 1;
	return row.value;
}

function redisSet(store, key, value, ttlMs) {
	store.redisKv.set(key, { value, expireAt: Date.now() + ttlMs });
	store.metrics.cacheRedisSet += 1;
}

function redisDel(store, key) {
	store.redisKv.delete(key);
}

function tryLock(store, key, token, ttlMs) {
	const current = store.locks.get(key);
	if (current && current.expireAt > Date.now()) {
		store.metrics.lockRejected += 1;
		return false;
	}
	store.locks.set(key, { token, expireAt: Date.now() + ttlMs });
	store.metrics.lockAcquired += 1;
	return true;
}

function unlock(store, key, token) {
	const current = store.locks.get(key);
	if (!current) return true;
	if (current.token !== token) return false;
	store.locks.delete(key);
	return true;
}

function casOccupy(store, tenantId, expectedVersion) {
	const slot = store.slot;
	if (slot.status !== 'AVAILABLE' || slot.version !== expectedVersion) {
		store.metrics.casConflict += 1;
		return { ok: false, reason: 'VERSION_CONFLICT', slot: { ...slot } };
	}
	slot.status = 'LEASED';
	slot.tenantId = tenantId;
	slot.version += 1;
	store.metrics.casSuccess += 1;
	redisDel(store, `schedule:${SLOT_ID}`);
	return { ok: true, slot: { ...slot } };
}

function expireLease(store, expectedVersion) {
	const slot = store.slot;
	if (slot.status !== 'LEASED' || slot.version !== expectedVersion) {
		store.metrics.expireDuplicateIgnored += 1;
		return { ok: false, reason: 'IDEMPOTENT_SKIP', slot: { ...slot } };
	}
	slot.billed = true;
	slot.billAmount += 128;
	slot.status = 'AVAILABLE';
	slot.tenantId = null;
	slot.resetCount += 1;
	slot.version += 1;
	store.metrics.expireFired += 1;
	redisDel(store, `schedule:${SLOT_ID}`);
	return { ok: true, slot: { ...slot } };
}

function resetSlot(store) {
	store.slot = {
		id: SLOT_ID,
		deviceId: 'gpu-a100-01',
		status: 'AVAILABLE',
		version: 1,
		tenantId: null,
		billed: false,
		billAmount: 0,
		resetCount: 0
	};
	store.locks.clear();
	store.redisKv.clear();
	store.delayQueue = [];
	store.metrics = {
		lockAcquired: 0,
		lockRejected: 0,
		casSuccess: 0,
		casConflict: 0,
		expireFired: 0,
		expireDuplicateIgnored: 0,
		cacheRedisSet: 0,
		cacheRedisHit: 0
	};
}

function pumpDelayQueue(store) {
	const due = [];
	const keep = [];
	const t = Date.now();
	for (const item of store.delayQueue) {
		if (item.deliverAt <= t) due.push(item);
		else keep.push(item);
	}
	store.delayQueue = keep;
	return due;
}

async function runCoordinator() {
	const store = createStore();
	const workers = [];
	const delaySamples = [];

	const server = http.createServer(async (req, res) => {
		try {
			const url = new URL(req.url, 'http://127.0.0.1');
			if (req.method === 'GET' && url.pathname === '/health') {
				return json(res, 200, { ok: true });
			}
			const body = req.method === 'POST' ? await readBody(req) : {};
			switch (url.pathname) {
				case '/redis/get':
					return json(res, 200, { value: redisGet(store, body.key) });
				case '/redis/set':
					redisSet(store, body.key, body.value, body.ttlMs);
					return json(res, 200, { ok: true });
				case '/redis/del':
					redisDel(store, body.key);
					return json(res, 200, { ok: true });
				case '/lock/try':
					return json(res, 200, {
						ok: tryLock(store, body.key, body.token, body.ttlMs)
					});
				case '/lock/unlock':
					return json(res, 200, {
						ok: unlock(store, body.key, body.token)
					});
				case '/db/slot':
					return json(res, 200, { slot: { ...store.slot } });
				case '/db/occupy':
					return json(
						res,
						200,
						casOccupy(store, body.tenantId, body.expectedVersion)
					);
				case '/db/expire':
					return json(res, 200, expireLease(store, body.expectedVersion));
				case '/db/reset':
					resetSlot(store);
					return json(res, 200, { slot: { ...store.slot } });
				case '/mq/delay': {
					const item = {
						id: randomUUID(),
						deliverAt: Date.now() + body.delayMs,
						expectedAt: nowMs() + body.delayMs,
						payload: body.payload
					};
					store.delayQueue.push(item);
					return json(res, 200, { ok: true, id: item.id });
				}
				case '/report':
					return json(res, 200, {
						slot: { ...store.slot },
						metrics: { ...store.metrics },
						pendingDelay: store.delayQueue.length
					});
				default:
					return json(res, 404, { error: 'not found' });
			}
		} catch (err) {
			return json(res, 500, { error: String(err && err.message) });
		}
	});

	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const port = server.address().port;

	const delayTimer = setInterval(async () => {
		const due = pumpDelayQueue(store);
		for (const item of due) {
			const firedAt = nowMs();
			const errorMs = firedAt - item.expectedAt;
			const result = expireLease(store, item.payload.version);
			delaySamples.push({
				id: item.id,
				delayMs: item.payload.delayMs,
				errorMs: Number(errorMs.toFixed(3)),
				result
			});
		}
	}, 5);

	function spawnWorker(nodeId, scenario) {
		return new Promise((resolve, reject) => {
			const child = fork(__filename, ['--worker'], {
				env: {
					...process.env,
					LEASE_SIM_PORT: String(port),
					LEASE_SIM_NODE: String(nodeId),
					LEASE_SIM_SCENARIO: scenario
				}
			});
			workers.push(child);
			let settled = false;
			child.on('message', (msg) => {
				if (msg && msg.type === 'done' && !settled) {
					settled = true;
					resolve(msg);
				}
			});
			child.on('error', (err) => {
				if (!settled) {
					settled = true;
					reject(err);
				}
			});
			child.on('exit', (code) => {
				if (!settled && code && code !== 0) {
					settled = true;
					reject(new Error(`worker ${nodeId} exited ${code}`));
				}
			});
		});
	}

	const cacheWorkers = await Promise.all([spawnWorker(9, 'cache')]);

	await rpc(port, '/db/reset', {});
	const occupyWorkers = await Promise.all(
		Array.from({ length: NODE_COUNT }, (_, i) => spawnWorker(i + 1, 'occupy'))
	);
	const afterOccupy = await rpc(port, '/report', {});

	for (const delayMs of DELAY_TARGETS_MS) {
		await rpc(port, '/mq/delay', {
			delayMs,
			payload: {
				type: 'EXPIRE',
				version: afterOccupy.slot.version,
				delayMs
			}
		});
	}
	await sleep(DELAY_TARGETS_MS[DELAY_TARGETS_MS.length - 1] + 250);
	clearInterval(delayTimer);
	const afterDelay = await rpc(port, '/report', {});

	await rpc(port, '/db/reset', {});
	const chaosWorkers = await Promise.all(
		Array.from({ length: NODE_COUNT }, (_, i) => spawnWorker(i + 5, 'chaos'))
	);
	const afterChaos = await rpc(port, '/report', {});

	const occupySuccess = occupyWorkers.reduce((n, w) => n + w.success, 0);
	const occupyFail = occupyWorkers.reduce((n, w) => n + w.fail, 0);
	const chaosSuccess = chaosWorkers.reduce((n, w) => n + w.success, 0);
	const cache = cacheWorkers[0].cache;

	const delayErrors = delaySamples.map((s) => Math.abs(s.errorMs));
	const maxDelayError = delayErrors.length ? Math.max(...delayErrors) : Infinity;
	const firedOnce = delaySamples.filter((s) => s.result.ok).length;
	const duplicateIgnored = delaySamples.filter((s) => !s.result.ok).length;

	const assertions = [
		{
			name: 'multi-node occupy has exactly one winner',
			ok: occupySuccess === 1 && occupyFail === NODE_COUNT * REQUESTS_PER_NODE - 1
		},
		{
			name: 'optimistic lock prevents oversell after occupy',
			ok: afterOccupy.slot.status === 'LEASED' && afterOccupy.metrics.casSuccess === 1
		},
		{
			name: 'chaos short-ttl lock still has a single consistent lease owner',
			ok: chaosSuccess === 1 && afterChaos.metrics.casSuccess === 1
		},
		{
			name: 'delay queue fires all scheduled messages',
			ok: delaySamples.length === DELAY_TARGETS_MS.length
		},
		{
			name: 'expire billing/reset is idempotent',
			ok: firedOnce === 1 && duplicateIgnored === DELAY_TARGETS_MS.length - 1
		},
		{
			name: `delay trigger error < ${DELAY_TOLERANCE_MS}ms`,
			ok: maxDelayError < DELAY_TOLERANCE_MS
		},
		{
			name: 'hot schedule query hits local then redis before db',
			ok: cache.localHits >= 1 && cache.redisHits >= 1 && cache.dbHits >= 1
		}
	];

	const report = {
		passed: assertions.every((a) => a.ok),
		assertions,
		occupy: {
			nodes: NODE_COUNT,
			requestsPerNode: REQUESTS_PER_NODE,
			total: NODE_COUNT * REQUESTS_PER_NODE,
			success: occupySuccess,
			fail: occupyFail,
			failReasons: occupyWorkers.reduce((acc, w) => {
				for (const [reason, count] of Object.entries(w.reasons)) {
					acc[reason] = (acc[reason] || 0) + count;
				}
				return acc;
			}, {})
		},
		chaos: {
			success: chaosSuccess,
			fail: chaosWorkers.reduce((n, w) => n + w.fail, 0)
		},
		cache,
		delayQueue: {
			samples: delaySamples.map((s) => ({
				delayMs: s.delayMs,
				errorMs: s.errorMs,
				ok: s.result.ok,
				reason: s.result.reason || 'FIRED'
			})),
			maxAbsErrorMs: Number(maxDelayError.toFixed(3)),
			firedOnce,
			duplicateIgnored
		},
		afterOccupy: afterOccupy.slot,
		afterDelay: afterDelay.slot,
		afterChaos: afterChaos.slot,
		metrics: {
			occupy: afterOccupy.metrics,
			delay: afterDelay.metrics,
			chaos: afterChaos.metrics
		}
	};

	console.log(JSON.stringify(report, null, 2));

	for (const child of workers) {
		if (child.connected) child.disconnect();
		child.kill();
	}
	server.close();
	process.exit(report.passed ? 0 : 1);
}

function createLocalCache() {
	const map = new Map();
	return {
		get(key) {
			const row = map.get(key);
			if (!row) return null;
			if (row.expireAt <= Date.now()) {
				map.delete(key);
				return null;
			}
			return row.value;
		},
		set(key, value, ttlMs) {
			map.set(key, { value, expireAt: Date.now() + ttlMs });
		},
		del(key) {
			map.delete(key);
		}
	};
}

async function runWorker() {
	const port = Number(process.env.LEASE_SIM_PORT);
	const nodeId = Number(process.env.LEASE_SIM_NODE);
	const scenario = process.env.LEASE_SIM_SCENARIO;
	const caffeine = createLocalCache();

	async function readSchedule() {
		const local = caffeine.get(SLOT_ID);
		if (local) return { source: 'local', slot: local };
		const redis = await rpc(port, '/redis/get', { key: `schedule:${SLOT_ID}` });
		if (redis.value) {
			caffeine.set(SLOT_ID, redis.value, HOT_LOCAL_TTL_MS);
			return { source: 'redis', slot: redis.value };
		}
		const db = await rpc(port, '/db/slot', {});
		await rpc(port, '/redis/set', {
			key: `schedule:${SLOT_ID}`,
			value: db.slot,
			ttlMs: HOT_REDIS_TTL_MS
		});
		caffeine.set(SLOT_ID, db.slot, HOT_LOCAL_TTL_MS);
		return { source: 'db', slot: db.slot };
	}

	async function occupyOnce(ttlMs, waitMs) {
		const tenantId = `node-${nodeId}-${randomUUID().slice(0, 8)}`;
		const token = randomUUID();
		const locked = await rpc(port, '/lock/try', {
			key: LOCK_KEY,
			token,
			ttlMs
		});
		if (!locked.ok) return { ok: false, reason: 'LOCK_HELD' };
		try {
			await sleep(waitMs);
			const current = await rpc(port, '/db/slot', {});
			if (current.slot.status !== 'AVAILABLE') {
				return { ok: false, reason: 'SOLD' };
			}
			const cas = await rpc(port, '/db/occupy', {
				tenantId,
				expectedVersion: current.slot.version
			});
			if (!cas.ok) return { ok: false, reason: cas.reason };
			caffeine.del(SLOT_ID);
			await rpc(port, '/redis/del', { key: `schedule:${SLOT_ID}` });
			return { ok: true, reason: 'LEASED', tenantId };
		} finally {
			await rpc(port, '/lock/unlock', { key: LOCK_KEY, token });
		}
	}

	if (scenario === 'cache') {
		caffeine.del(SLOT_ID);
		await rpc(port, '/redis/del', { key: `schedule:${SLOT_ID}` });
		const sources = [];
		sources.push((await readSchedule()).source);
		sources.push((await readSchedule()).source);
		await sleep(HOT_LOCAL_TTL_MS + 20);
		sources.push((await readSchedule()).source);
		await sleep(HOT_REDIS_TTL_MS + 20);
		caffeine.del(SLOT_ID);
		sources.push((await readSchedule()).source);
		process.send(
			{
				type: 'done',
				cache: {
					sources,
					localHits: sources.filter((s) => s === 'local').length,
					redisHits: sources.filter((s) => s === 'redis').length,
					dbHits: sources.filter((s) => s === 'db').length
				},
				success: 0,
				fail: 0,
				reasons: {}
			},
			() => process.exit(0)
		);
		return;
	}

	const ttlMs = scenario === 'chaos' ? 8 : 3000;
	const waitMs = scenario === 'chaos' ? 20 : 8 + Math.floor(Math.random() * 12);
	const count = scenario === 'chaos' ? 16 : REQUESTS_PER_NODE;
	const tasks = Array.from({ length: count }, () => occupyOnce(ttlMs, waitMs));
	const results = await Promise.all(tasks);
	const reasons = {};
	let success = 0;
	let fail = 0;
	for (const item of results) {
		if (item.ok) success += 1;
		else {
			fail += 1;
			reasons[item.reason] = (reasons[item.reason] || 0) + 1;
		}
	}
	process.send({ type: 'done', success, fail, reasons }, () => process.exit(0));
}
