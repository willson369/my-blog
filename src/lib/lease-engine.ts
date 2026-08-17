/**
 * Time-slice lease kernel.
 * Caffeine + Redis-like cache, Redisson-like lock, MySQL version CAS,
 * RabbitMQ-like delayed expire. No extra services — keeps the repo small.
 */

export const SLOT_MS = 12_000;
export const LOCAL_TTL_MS = 400;
export const REDIS_TTL_MS = 1_200;
export const STORE_KEY = 'kevin.dc.lease.v2';

export type Tenant = {
	id: string;
	name: string;
};

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
};

export type ClusterState = {
	slots: Slot[];
	bills: Bill[];
	events: LeaseEvent[];
	metrics: Metrics;
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

const emptyMetrics = (): Metrics => ({
	localHit: 0,
	redisHit: 0,
	dbHit: 0,
	lockHeld: 0,
	sold: 0,
	casConflict: 0,
	leased: 0,
	expired: 0,
	expireSkip: 0
});

export function priceFen(device: Device): number {
	return Math.ceil((device.priceFenPerHour * SLOT_MS) / 3_600_000);
}

export function seedState(now = Date.now()): ClusterState {
	return {
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
				at: now,
				level: 'info',
				message:
					'集群就绪。CU = vCPU + GPU 权重（T4=16 / 4090=32 / A100=56），按 SKU 时价计费。'
			}
		],
		metrics: emptyMetrics()
	};
}

type CacheEntry = { at: number; slots: Slot[] };

export type OccupyResult = {
	ok: boolean;
	reason: 'LEASED' | 'LOCK_HELD' | 'SOLD' | 'VERSION_CONFLICT' | 'GONE';
	slot?: Slot;
};

export type LeaseRuntime = {
	nodeId: string;
	snapshot: () => ClusterState;
	schedule: (deviceId: string) => {
		source: 'local' | 'redis' | 'db';
		slots: Slot[];
	};
	occupy: (slotId: string, tenantId: string) => Promise<OccupyResult>;
	storm: (
		slotId: string,
		n?: number
	) => Promise<{ leased: number; reasons: Record<string, number> }>;
	reset: () => void;
	subscribe: (fn: () => void) => () => void;
	dispose: () => void;
};

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function loadStore(): ClusterState | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(STORE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as ClusterState;
		if (
			!Array.isArray(parsed.slots) ||
			parsed.slots.length !== DEVICES.length * HOURS.length
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function saveStore(state: ClusterState) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function lockSlot<T>(
	key: string,
	fn: () => Promise<T>
): Promise<T | { ok: false; reason: 'LOCK_HELD' }> {
	const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
	if (!locks?.request) return fn();
	return new Promise((resolve) => {
		void locks.request(key, { ifAvailable: true }, async (lock) => {
			if (!lock) {
				resolve({ ok: false, reason: 'LOCK_HELD' });
				return;
			}
			resolve(await fn());
		});
	});
}

export function createLeaseRuntime(
	nodeId = `n-${Math.random().toString(36).slice(2, 7)}`
): LeaseRuntime {
	let state = loadStore() ?? seedState();
	const local = new Map<string, CacheEntry>();
	const redis = new Map<string, CacheEntry>();
	const listeners = new Set<() => void>();
	const timers = new Map<string, number>();
	const channel =
		typeof BroadcastChannel !== 'undefined'
			? new BroadcastChannel('kevin.dc.lease')
			: null;

	const emit = () => {
		listeners.forEach((fn) => fn());
		channel?.postMessage({ type: 'sync', nodeId });
	};

	const persist = () => {
		saveStore(state);
		emit();
	};

	const note = (level: LeaseEvent['level'], message: string) => {
		state.events = [{ at: Date.now(), level, message }, ...state.events].slice(
			0,
			36
		);
	};

	const invalidate = (deviceId: string) => {
		local.delete(deviceId);
		redis.delete(deviceId);
	};

	const expireDue = (now = Date.now()) => {
		let changed = false;
		for (const slot of state.slots) {
			if (slot.status !== 'LEASED' || !slot.leaseUntil || slot.leaseUntil > now)
				continue;
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
			invalidate(slot.deviceId);
			note(
				'ok',
				`${slot.id} 到期扣费 ¥${(priceFen(device) / 100).toFixed(2)}，设备已重置`
			);
			changed = true;
			const timer = timers.get(slot.id);
			if (timer) {
				window.clearTimeout(timer);
				timers.delete(slot.id);
			}
		}
		if (changed) persist();
		return changed;
	};

	const armTimer = (slot: Slot) => {
		if (typeof window === 'undefined' || !slot.leaseUntil) return;
		const prev = timers.get(slot.id);
		if (prev) window.clearTimeout(prev);
		const wait = Math.max(0, slot.leaseUntil - Date.now());
		timers.set(
			slot.id,
			window.setTimeout(() => {
				expireDue();
			}, wait)
		);
	};

	state.slots.filter((slot) => slot.status === 'LEASED').forEach(armTimer);

	const onStorage = (event: StorageEvent) => {
		if (event.key !== STORE_KEY || !event.newValue) return;
		try {
			state = JSON.parse(event.newValue) as ClusterState;
			local.clear();
			redis.clear();
			emit();
		} catch {
			/* ignore */
		}
	};
	const onMessage = (event: MessageEvent) => {
		if (event.data?.nodeId === nodeId) return;
		const next = loadStore();
		if (!next) return;
		state = next;
		local.clear();
		redis.clear();
		listeners.forEach((fn) => fn());
	};
	if (typeof window !== 'undefined') {
		window.addEventListener('storage', onStorage);
		channel?.addEventListener('message', onMessage);
	}

	const snapshot = () => {
		expireDue();
		return clone(state);
	};

	const schedule = (deviceId: string) => {
		expireDue();
		const now = Date.now();
		const l1 = local.get(deviceId);
		if (l1 && now - l1.at < LOCAL_TTL_MS) {
			state.metrics.localHit += 1;
			return { source: 'local' as const, slots: clone(l1.slots) };
		}
		const l2 = redis.get(deviceId);
		if (l2 && now - l2.at < REDIS_TTL_MS) {
			state.metrics.redisHit += 1;
			local.set(deviceId, { at: now, slots: l2.slots });
			return { source: 'redis' as const, slots: clone(l2.slots) };
		}
		state.metrics.dbHit += 1;
		const slots = state.slots.filter((slot) => slot.deviceId === deviceId);
		redis.set(deviceId, { at: now, slots });
		local.set(deviceId, { at: now, slots });
		return { source: 'db' as const, slots: clone(slots) };
	};

	const occupy = async (
		slotId: string,
		tenantId: string
	): Promise<OccupyResult> => {
		const run = async (): Promise<OccupyResult> => {
			expireDue();
			const current = state.slots.find((item) => item.id === slotId);
			if (!current) return { ok: false, reason: 'GONE' };
			if (current.status !== 'AVAILABLE') {
				state.metrics.sold += 1;
				return { ok: false, reason: 'SOLD', slot: clone(current) };
			}
			const expected = current.version;
			await new Promise((resolve) => setTimeout(resolve, 4));
			expireDue();
			const slot = state.slots.find((item) => item.id === slotId);
			if (!slot) return { ok: false, reason: 'GONE' };
			if (slot.status !== 'AVAILABLE') {
				state.metrics.sold += 1;
				return { ok: false, reason: 'SOLD', slot: clone(slot) };
			}
			if (slot.version !== expected) {
				state.metrics.casConflict += 1;
				return { ok: false, reason: 'VERSION_CONFLICT', slot: clone(slot) };
			}
			slot.status = 'LEASED';
			slot.tenantId = tenantId;
			slot.leaseUntil = Date.now() + SLOT_MS;
			slot.version += 1;
			state.metrics.leased += 1;
			invalidate(slot.deviceId);
			armTimer(slot);
			note('ok', `${tenantId} 抢到 ${slot.id}  v${slot.version}`);
			persist();
			return { ok: true, reason: 'LEASED', slot: clone(slot) };
		};

		const locked = await lockSlot(`lease:${slotId}`, run);
		if (
			locked &&
			typeof locked === 'object' &&
			'ok' in locked &&
			locked.ok === false &&
			locked.reason === 'LOCK_HELD'
		) {
			state.metrics.lockHeld += 1;
			return { ok: false, reason: 'LOCK_HELD' };
		}
		return locked as OccupyResult;
	};

	return {
		nodeId,
		snapshot,
		schedule,
		occupy,
		async storm(slotId: string, n = 160) {
			const tasks = Array.from({ length: n }, (_, index) =>
				occupy(slotId, `storm-${index}`)
			);
			const results = await Promise.all(tasks);
			const reasons: Record<string, number> = {};
			let leased = 0;
			for (const item of results) {
				if (item.ok) leased += 1;
				reasons[item.reason] = (reasons[item.reason] || 0) + 1;
			}
			note(
				leased === 1 ? 'ok' : 'warn',
				`风暴 ${n} 并发 → 成交 ${leased}（${Object.entries(reasons)
					.map(([key, value]) => `${key}:${value}`)
					.join(' ')})`
			);
			persist();
			return { leased, reasons };
		},
		reset() {
			timers.forEach((id) => window.clearTimeout(id));
			timers.clear();
			local.clear();
			redis.clear();
			state = seedState();
			persist();
		},
		subscribe(fn) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		dispose() {
			timers.forEach((id) => window.clearTimeout(id));
			channel?.close();
			if (typeof window !== 'undefined') {
				window.removeEventListener('storage', onStorage);
			}
		}
	};
}
