import 'server-only';

/**
 * High-concurrency lease kernel. One file on purpose (Windows NTFS
 * allocates a cluster per file; extra packages also explode node_modules).
 *
 * Redis commands: GET/SET NX PX, DEL, INCR, PEXPIRE, ZADD/ZRANGEBYSCORE/ZREM,
 * LPUSH/LTRIM/LRANGE, pipeline. Upstash REST when env is set (connectionless,
 * the serverless way to survive tens of thousands of concurrent functions).
 * Otherwise a process-global embedded Redis with the same command set.
 */

export const SLOT_MS = 12_000;
export const LOCAL_TTL_MS = 400;
export const REDIS_TTL_MS = 1_200;
export const LOCK_PX = 2_500;
export const RATE_MAX = 80;

export type Tenant = { id: string; name: string };
export type Device = {
	id: string;
	sku: string;
	name: string;
	kind: 'CPU' | 'GPU';
	vcpu: number;
	gpu: string;
	vramGb: number;
	cu: number;
	priceFenPerHour: number;
};
export type Slot = {
	id: string;
	deviceId: string;
	label: string;
	status: 'AVAILABLE' | 'LEASED';
	version: number;
	tenantId: string | null;
	leaseUntil: number | null;
};
export type Bill = {
	id: string;
	slotId: string;
	tenantId: string;
	fen: number;
	at: number;
};
export type LeaseEvent = {
	at: number;
	level: 'ok' | 'warn' | 'info';
	message: string;
};
export type Metrics = {
	localHit: number;
	redisHit: number;
	dbHit: number;
	lockHeld: number;
	sold: number;
	casConflict: number;
	leased: number;
	expired: number;
	expireSkip: number;
	rateLimited: number;
	redisCmds: number;
};
export type ClusterState = {
	backend: 'upstash' | 'embedded-redis';
	nodeId: string;
	slots: Slot[];
	bills: Bill[];
	events: LeaseEvent[];
	metrics: Metrics;
	cmds: string[];
	devices: Device[];
	tenants: Tenant[];
};
export type OccupyResult = {
	ok: boolean;
	reason:
		| 'LEASED'
		| 'LOCK_HELD'
		| 'SOLD'
		| 'VERSION_CONFLICT'
		| 'GONE'
		| 'RATE_LIMITED';
	slot?: Slot;
};

export const TENANTS: Tenant[] = [
	{ id: 'spark', name: '星火实验室' },
	{ id: 'hongbi', name: '红笔工坊' },
	{ id: 'campus', name: '校园 AI 社' }
];

export const DEVICES: Device[] = [
	{
		id: 'cpu-16',
		sku: 'CPU-16C',
		name: '编译节点',
		kind: 'CPU',
		vcpu: 16,
		gpu: '—',
		vramGb: 0,
		cu: 16,
		priceFenPerHour: 600
	},
	{
		id: 'gpu-t4',
		sku: 'T4-16G',
		name: '推理卡',
		kind: 'GPU',
		vcpu: 8,
		gpu: 'Tesla T4',
		vramGb: 16,
		cu: 24,
		priceFenPerHour: 1800
	},
	{
		id: 'gpu-4090',
		sku: '4090-24G',
		name: '训练卡',
		kind: 'GPU',
		vcpu: 16,
		gpu: 'RTX 4090',
		vramGb: 24,
		cu: 48,
		priceFenPerHour: 3200
	},
	{
		id: 'gpu-a100',
		sku: 'A100-40G',
		name: '高算卡',
		kind: 'GPU',
		vcpu: 24,
		gpu: 'A100 40GB',
		vramGb: 40,
		cu: 80,
		priceFenPerHour: 6800
	}
];

const HOURS = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
const STATE_KEY = 'lease:state';
const DELAY_KEY = 'lease:delay';
const CMDS_KEY = 'lease:cmds';
const NODE_ID = `api-${Math.random().toString(36).slice(2, 7)}`;

export function priceFen(device: Device): number {
	return Math.ceil((device.priceFenPerHour * SLOT_MS) / 3_600_000);
}

const METRIC_KEYS: Array<keyof Metrics> = [
	'localHit',
	'redisHit',
	'dbHit',
	'lockHeld',
	'sold',
	'casConflict',
	'leased',
	'expired',
	'expireSkip',
	'rateLimited',
	'redisCmds'
];

function emptyMetrics(): Metrics {
	return {
		localHit: 0,
		redisHit: 0,
		dbHit: 0,
		lockHeld: 0,
		sold: 0,
		casConflict: 0,
		leased: 0,
		expired: 0,
		expireSkip: 0,
		rateLimited: 0,
		redisCmds: 0
	};
}

async function bump(redis: RedisBus, name: keyof Metrics) {
	const n = Number((await redis.run(['INCR', `m:${name}`])) ?? 0);
	return n;
}

async function readMetrics(redis: RedisBus): Promise<Metrics> {
	const metrics = emptyMetrics();
	const cmds = METRIC_KEYS.map(
		(key) => ['GET', `m:${key}`] as Array<string | number>
	);
	const rows = await redis.pipeline(cmds);
	METRIC_KEYS.forEach((key, index) => {
		const raw = rows[index];
		if (raw != null && raw !== '') metrics[key] = Number(raw);
	});
	return metrics;
}

export function seedState(): ClusterState {
	return {
		backend: 'embedded-redis',
		nodeId: NODE_ID,
		slots: DEVICES.flatMap((device) =>
			HOURS.map((label) => ({
				id: `${device.id}:${label}`,
				deviceId: device.id,
				label,
				status: 'AVAILABLE' as const,
				version: 1,
				tenantId: null,
				leaseUntil: null
			}))
		),
		bills: [],
		events: [
			{
				at: Date.now(),
				level: 'info',
				message:
					'Redis 内核就绪：SET NX 锁 / ZSET 延迟队列 / INCR 滑动窗口 / Caffeine+Redis 多级缓存。'
			}
		],
		metrics: emptyMetrics(),
		cmds: [],
		devices: DEVICES,
		tenants: TENANTS
	};
}

type RedisValue = { v: string; exp?: number };

class EmbeddedRedis {
	backend = 'embedded-redis' as const;
	private kv = new Map<string, RedisValue>();
	private zset = new Map<string, Map<string, number>>();
	private lists = new Map<string, string[]>();

	private alive(row?: RedisValue) {
		if (!row) return false;
		if (row.exp && row.exp <= Date.now()) return false;
		return true;
	}

	async run(
		cmd: Array<string | number>
	): Promise<string | number | string[] | null> {
		const op = String(cmd[0]).toUpperCase();
		const key = String(cmd[1] ?? '');
		if (op === 'GET') {
			const row = this.kv.get(key);
			if (!this.alive(row)) {
				this.kv.delete(key);
				return null;
			}
			return row!.v;
		}
		if (op === 'SET') {
			const value = String(cmd[2]);
			const nx = cmd.some((item) => String(item).toUpperCase() === 'NX');
			const pxAt = cmd.findIndex((item) => String(item).toUpperCase() === 'PX');
			const px = pxAt >= 0 ? Number(cmd[pxAt + 1]) : undefined;
			if (nx && this.alive(this.kv.get(key))) return null;
			this.kv.set(key, { v: value, exp: px ? Date.now() + px : undefined });
			return 'OK';
		}
		if (op === 'DEL') {
			this.kv.delete(key);
			this.zset.delete(key);
			return 1;
		}
		if (op === 'INCR') {
			const cur = this.alive(this.kv.get(key))
				? Number(this.kv.get(key)!.v)
				: 0;
			const next = cur + 1;
			const exp = this.kv.get(key)?.exp;
			this.kv.set(key, { v: String(next), exp });
			return next;
		}
		if (op === 'PEXPIRE') {
			const row = this.kv.get(key);
			if (!this.alive(row)) return 0;
			row!.exp = Date.now() + Number(cmd[2]);
			return 1;
		}
		if (op === 'ZADD') {
			const bucket = this.zset.get(key) ?? new Map<string, number>();
			bucket.set(String(cmd[3]), Number(cmd[2]));
			this.zset.set(key, bucket);
			return 1;
		}
		if (op === 'ZRANGEBYSCORE') {
			const min = Number(cmd[2]);
			const max = Number(cmd[3]);
			const bucket = this.zset.get(key) ?? new Map();
			return Array.from(bucket.entries())
				.filter(([, score]) => score >= min && score <= max)
				.sort((a, b) => a[1] - b[1])
				.map(([member]) => member);
		}
		if (op === 'ZREM') {
			this.zset.get(key)?.delete(String(cmd[2]));
			return 1;
		}
		if (op === 'LPUSH') {
			const list = this.lists.get(key) ?? [];
			list.unshift(String(cmd[2]));
			this.lists.set(key, list);
			return list.length;
		}
		if (op === 'LTRIM') {
			const list = this.lists.get(key) ?? [];
			this.lists.set(key, list.slice(Number(cmd[2]), Number(cmd[3]) + 1));
			return 'OK';
		}
		if (op === 'LRANGE') {
			const list = this.lists.get(key) ?? [];
			return list.slice(Number(cmd[2]), Number(cmd[3]) + 1);
		}
		return null;
	}

	async pipeline(cmds: Array<Array<string | number>>) {
		const out = [];
		for (const cmd of cmds) out.push(await this.run(cmd));
		return out;
	}
}

type RedisBus = {
	backend: ClusterState['backend'];
	run: (
		cmd: Array<string | number>
	) => Promise<string | number | string[] | null>;
	pipeline: (
		cmds: Array<Array<string | number>>
	) => Promise<Array<string | number | string[] | null>>;
};

function upstash(): RedisBus | null {
	const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
	const token =
		process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
	if (!url || !token) return null;
	const call = async (body: unknown) => {
		const res = await fetch(`${url}/pipeline`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body),
			cache: 'no-store'
		});
		if (!res.ok) throw new Error(`upstash ${res.status}`);
		const json = (await res.json()) as Array<{
			result: string | number | string[] | null;
		}>;
		return json.map((row) => row.result);
	};
	return {
		backend: 'upstash',
		async run(cmd) {
			const [result] = await call([cmd]);
			return result ?? null;
		},
		async pipeline(cmds) {
			return call(cmds);
		}
	};
}

const g = globalThis as typeof globalThis & {
	__leaseRedis?: EmbeddedRedis;
	__leaseLocal?: Map<string, { at: number; slots: Slot[] }>;
};

function bus(): RedisBus {
	const remote = upstash();
	if (remote) return remote;
	g.__leaseRedis ??= new EmbeddedRedis();
	return g.__leaseRedis;
}

function localCache() {
	g.__leaseLocal ??= new Map();
	return g.__leaseLocal;
}

async function loadState(redis: RedisBus): Promise<ClusterState> {
	const raw = await redis.run(['GET', STATE_KEY]);
	if (typeof raw === 'string' && raw) {
		try {
			const parsed = JSON.parse(raw) as ClusterState;
			if (parsed.slots?.length === DEVICES.length * HOURS.length) {
				parsed.backend = redis.backend;
				parsed.devices = DEVICES;
				parsed.tenants = TENANTS;
				parsed.metrics = await readMetrics(redis);
				return parsed;
			}
		} catch {
			/* reset */
		}
	}
	const seeded = seedState();
	seeded.backend = redis.backend;
	await redis.run(['SET', STATE_KEY, JSON.stringify(seeded)]);
	return seeded;
}

async function saveState(redis: RedisBus, state: ClusterState) {
	state.backend = redis.backend;
	state.nodeId = NODE_ID;
	await redis.run(['SET', STATE_KEY, JSON.stringify(state)]);
}

async function trace(redis: RedisBus, line: string) {
	await redis.pipeline([
		['LPUSH', CMDS_KEY, line],
		['LTRIM', CMDS_KEY, 0, 11]
	]);
}

async function expireDue(
	redis: RedisBus,
	state: ClusterState,
	now = Date.now()
) {
	const due = await redis.run(['ZRANGEBYSCORE', DELAY_KEY, 0, now]);
	const members = Array.isArray(due) ? due : [];
	for (const slotId of members) {
		await redis.run(['ZREM', DELAY_KEY, slotId]);
		const slot = state.slots.find((item) => item.id === slotId);
		if (!slot || slot.status !== 'LEASED') {
			state.metrics.expireSkip += 1;
			await bump(redis, 'expireSkip');
			continue;
		}
		const device = DEVICES.find((item) => item.id === slot.deviceId);
		if (!device || !slot.tenantId) continue;
		state.bills.unshift({
			id: `${slot.id}:${slot.version}`,
			slotId: slot.id,
			tenantId: slot.tenantId,
			fen: priceFen(device),
			at: now
		});
		slot.status = 'AVAILABLE';
		slot.tenantId = null;
		slot.leaseUntil = null;
		slot.version += 1;
		state.metrics.expired += 1;
		await bump(redis, 'expired');
		localCache().delete(slot.deviceId);
		await redis.run(['DEL', `cache:${slot.deviceId}`]);
		state.events.unshift({
			at: now,
			level: 'ok',
			message: `ZREM delay ${slot.id} 到期扣费 ¥${(priceFen(device) / 100).toFixed(2)}`
		});
	}
	if (members.length) await saveState(redis, state);
}

async function limited(redis: RedisBus, ip: string, burst: number) {
	const key = `rl:${ip}:${Math.floor(Date.now() / 1000)}`;
	const n = Number((await redis.run(['INCR', key])) ?? 0);
	if (n === 1) await redis.run(['PEXPIRE', key, 1000]);
	return n > burst;
}

export async function snapshot(): Promise<ClusterState> {
	const redis = bus();
	const state = await loadState(redis);
	await expireDue(redis, state);
	const cmds = await redis.run(['LRANGE', CMDS_KEY, 0, 11]);
	state.cmds = Array.isArray(cmds) ? cmds : [];
	await bump(redis, 'redisCmds');
	state.metrics = await readMetrics(redis);
	state.backend = redis.backend;
	state.nodeId = NODE_ID;
	return state;
}

export async function schedule(deviceId: string) {
	const redis = bus();
	const state = await loadState(redis);
	await expireDue(redis, state);
	const now = Date.now();
	const l1 = localCache().get(deviceId);
	if (l1 && now - l1.at < LOCAL_TTL_MS) {
		await bump(redis, 'localHit');
		return { source: 'local' as const, slots: l1.slots };
	}
	const cached = await redis.run(['GET', `cache:${deviceId}`]);
	if (typeof cached === 'string' && cached) {
		state.metrics.redisHit += 1;
		await bump(redis, 'redisHit');
		const slots = JSON.parse(cached) as Slot[];
		localCache().set(deviceId, { at: now, slots });
		await saveState(redis, state);
		await trace(redis, `GET cache:${deviceId} HIT`);
		return { source: 'redis' as const, slots };
	}
	await bump(redis, 'dbHit');
	const slots = state.slots.filter((slot) => slot.deviceId === deviceId);
	await redis.pipeline([
		['SET', `cache:${deviceId}`, JSON.stringify(slots), 'PX', REDIS_TTL_MS],
		['LPUSH', CMDS_KEY, `SET cache:${deviceId} PX ${REDIS_TTL_MS}`],
		['LTRIM', CMDS_KEY, 0, 11]
	]);
	localCache().set(deviceId, { at: now, slots });
	await saveState(redis, state);
	return { source: 'db' as const, slots };
}

export async function occupy(
	slotId: string,
	tenantId: string,
	ip = 'local'
): Promise<OccupyResult> {
	const redis = bus();
	const state = await loadState(redis);
	if (await limited(redis, ip, RATE_MAX)) {
		await bump(redis, 'rateLimited');
		await trace(redis, `INCR rl:${ip} RATE_LIMITED`);
		return { ok: false, reason: 'RATE_LIMITED' };
	}
	const token = `${NODE_ID}-${Math.random().toString(36).slice(2, 8)}`;
	const lockKey = `lock:${slotId}`;
	const got = await redis.run(['SET', lockKey, token, 'NX', 'PX', LOCK_PX]);
	await bump(redis, 'redisCmds');
	if (got !== 'OK') {
		await bump(redis, 'lockHeld');
		await trace(redis, `SET ${lockKey} NX PX ${LOCK_PX} → NIL`);
		return { ok: false, reason: 'LOCK_HELD' };
	}
	await trace(redis, `SET ${lockKey} NX PX ${LOCK_PX} → OK`);
	try {
		await expireDue(redis, state);
		const expected = state.slots.find((item) => item.id === slotId);
		if (!expected) return { ok: false, reason: 'GONE' };
		if (expected.status !== 'AVAILABLE') {
			await bump(redis, 'sold');
			return { ok: false, reason: 'SOLD', slot: expected };
		}
		const version = expected.version;
		await new Promise((resolve) => setTimeout(resolve, 3));
		const fresh = await loadState(redis);
		const slot = fresh.slots.find((item) => item.id === slotId);
		if (!slot) return { ok: false, reason: 'GONE' };
		if (slot.status !== 'AVAILABLE') {
			await bump(redis, 'sold');
			return { ok: false, reason: 'SOLD', slot };
		}
		if (slot.version !== version) {
			await bump(redis, 'casConflict');
			return { ok: false, reason: 'VERSION_CONFLICT', slot };
		}
		slot.status = 'LEASED';
		slot.tenantId = tenantId;
		slot.leaseUntil = Date.now() + SLOT_MS;
		slot.version += 1;
		await bump(redis, 'leased');
		fresh.events.unshift({
			at: Date.now(),
			level: 'ok',
			message: `${tenantId} 抢到 ${slot.id} v${slot.version}`
		});
		fresh.events = fresh.events.slice(0, 36);
		localCache().delete(slot.deviceId);
		await redis.pipeline([
			['ZADD', DELAY_KEY, slot.leaseUntil, slot.id],
			['DEL', `cache:${slot.deviceId}`],
			['LPUSH', CMDS_KEY, `ZADD delay ${slot.leaseUntil} ${slot.id}`],
			['LTRIM', CMDS_KEY, 0, 11]
		]);
		await saveState(redis, fresh);
		return { ok: true, reason: 'LEASED', slot };
	} finally {
		const cur = await redis.run(['GET', lockKey]);
		if (cur === token) await redis.run(['DEL', lockKey]);
	}
}

export async function storm(slotId: string, n = 160, ip = 'storm') {
	const results = await Promise.all(
		Array.from({ length: n }, (_, index) =>
			occupy(slotId, `storm-${index}`, `${ip}:${index}`)
		)
	);
	const reasons: Record<string, number> = {};
	let leased = 0;
	for (const item of results) {
		if (item.ok) leased += 1;
		reasons[item.reason] = (reasons[item.reason] || 0) + 1;
	}
	const redis = bus();
	const state = await loadState(redis);
	state.events.unshift({
		at: Date.now(),
		level: leased === 1 ? 'ok' : 'warn',
		message: `风暴 ${n} → 成交 ${leased} ${Object.entries(reasons)
			.map(([key, value]) => `${key}:${value}`)
			.join(' ')}`
	});
	await saveState(redis, state);
	await trace(redis, `pipeline occupy x${n} leased=${leased}`);
	return { leased, reasons, state: await snapshot() };
}

export async function resetCluster() {
	const redis = bus();
	g.__leaseLocal = new Map();
	await redis.pipeline([
		['DEL', STATE_KEY],
		['DEL', DELAY_KEY],
		['DEL', CMDS_KEY],
		...METRIC_KEYS.map((key) => ['DEL', `m:${key}`] as Array<string | number>)
	]);
	return snapshot();
}
