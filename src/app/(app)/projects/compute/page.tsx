'use client';

import { Container } from '@/components/Container';
import { cn } from '@/lib/utils';
import React from 'react';

type Device = {
	id: string;
	sku: string;
	name: string;
	vcpu: number;
	gpu: string;
	vramGb: number;
	cu: number;
	priceFenPerHour: number;
};
type Tenant = { id: string; name: string };
type Slot = {
	id: string;
	deviceId: string;
	status: 'AVAILABLE' | 'LEASED';
	version: number;
	tenantId: string | null;
	leaseUntil: number | null;
};
type State = {
	backend: 'upstash' | 'embedded-redis';
	nodeId: string;
	slots: Slot[];
	bills: { id: string; slotId: string; tenantId: string; fen: number }[];
	events: { at: number; message: string }[];
	metrics: {
		localHit: number;
		redisHit: number;
		dbHit: number;
		lockHeld: number;
		sold: number;
		casConflict: number;
		leased: number;
		expired: number;
		rateLimited: number;
		redisCmds: number;
	};
	cmds: string[];
	devices: Device[];
	tenants: Tenant[];
};

const HOURS = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
const SLOT_MS = 12_000;

function fenYuan(fen: number) {
	return `¥${(fen / 100).toFixed(2)}`;
}

function priceFen(device: Device) {
	return Math.ceil((device.priceFenPerHour * SLOT_MS) / 3_600_000);
}

async function api(action?: string, extra?: Record<string, string | number>) {
	if (!action) {
		const res = await fetch('/api/lease', { cache: 'no-store' });
		return res.json();
	}
	const res = await fetch('/api/lease', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action, ...extra })
	});
	return res.json();
}

export default function ComputePage() {
	const [state, setState] = React.useState<State | null>(null);
	const [now, setNow] = React.useState(() => Date.now());
	const [tenantId, setTenantId] = React.useState('spark');
	const [busy, setBusy] = React.useState<string | null>(null);
	const [flash, setFlash] = React.useState('');
	const [picked, setPicked] = React.useState('gpu-a100:10:00');

	const pull = React.useCallback(async () => {
		const next = (await api()) as State;
		setState(next);
		if (next.tenants?.[0] && !next.tenants.some((t) => t.id === tenantId)) {
			setTenantId(next.tenants[0].id);
		}
	}, [tenantId]);

	React.useEffect(() => {
		void pull();
		const clock = window.setInterval(() => {
			setNow(Date.now());
			void pull();
		}, 1000);
		return () => window.clearInterval(clock);
	}, [pull]);

	const occupy = async (slotId: string) => {
		if (busy) return;
		setBusy(slotId);
		const result = await api('occupy', { slotId, tenantId });
		setFlash(result.ok ? `成交 ${slotId}` : `未抢到：${result.reason}`);
		await pull();
		setBusy(null);
	};

	const storm = async () => {
		if (busy || !state) return;
		const target =
			state.slots.find(
				(slot) => slot.id === picked && slot.status === 'AVAILABLE'
			) ?? state.slots.find((slot) => slot.status === 'AVAILABLE');
		if (!target) {
			setFlash('没有可抢时段，先重置集群');
			return;
		}
		setPicked(target.id);
		setBusy('storm');
		const result = await api('storm', { slotId: target.id, n: 160 });
		setFlash(
			`160 并发抢 ${target.id} → 成交 ${result.leased} ${Object.entries(
				result.reasons as Record<string, number>
			)
				.map(([key, value]) => `${key} ${value}`)
				.join(' / ')}`
		);
		if (result.state) setState(result.state as State);
		else await pull();
		setBusy(null);
	};

	if (!state) {
		return (
			<Container className="mt-16 sm:mt-24">
				<p className="font-mono text-sm text-zinc-500">
					正在连接 Redis 调度内核…
				</p>
			</Container>
		);
	}

	const billed = state.bills.reduce((sum, bill) => sum + bill.fen, 0);
	const live = state.slots.filter((slot) => slot.status === 'LEASED').length;
	const hits = state.metrics.localHit + state.metrics.redisHit;

	return (
		<Container className="mt-16 sm:mt-24">
			<header className="max-w-3xl">
				<p className="font-mono text-xs uppercase tracking-[0.22em] text-teal-700 dark:text-teal-300">
					kevin@cluster:~$ redis-cli monitor
				</p>
				<h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100 sm:text-4xl">
					算力分时调度台
				</h1>
				<p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
					服务端 Redis 内核。点「160 并发」看 SET NX 是否只让 1
					个请求拿到锁。配置 UPSTASH_REDIS_REST_URL 后所有访客共享同一集群。
				</p>
			</header>

			<div className="mt-10 space-y-5">
				<section className="overflow-hidden rounded-xl border border-teal-700/20 bg-zinc-950 text-zinc-100 shadow-lg">
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
						<div>
							<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal-300/90">
								{state.backend} · {state.nodeId}
							</p>
							<h2 className="mt-1 text-base font-semibold">Redis 高并发调度</h2>
						</div>
						<p className="max-w-md text-xs leading-relaxed text-zinc-400">
							SET NX PX 锁 · ZSET 到期队列 · INCR 滑动窗口 · pipeline 缓存失效 ·
							version CAS
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
						<label className="flex items-center gap-2 text-xs text-zinc-400">
							租户
							<select
								value={tenantId}
								onChange={(event) => setTenantId(event.target.value)}
								className="rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-zinc-100"
							>
								{state.tenants.map((tenant) => (
									<option key={tenant.id} value={tenant.id}>
										{tenant.name}
									</option>
								))}
							</select>
						</label>
						<button
							type="button"
							onClick={() => occupy(picked)}
							disabled={!!busy}
							className="rounded-md bg-teal-400/90 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-teal-300 disabled:opacity-50"
						>
							抢占选中时段
						</button>
						<button
							type="button"
							onClick={storm}
							disabled={!!busy}
							className="rounded-md border border-teal-300/40 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-200 hover:bg-teal-400/20 disabled:opacity-50"
						>
							{busy === 'storm' ? '风暴进行中…' : '160 并发抢同一 slot'}
						</button>
						<button
							type="button"
							onClick={async () => {
								setBusy('reset');
								setState((await api('reset')) as State);
								setBusy(null);
							}}
							disabled={!!busy}
							className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
						>
							重置集群
						</button>
					</div>
				</section>

				{flash ? (
					<p className="rounded-lg border border-teal-700/20 bg-teal-50/80 px-3 py-2 font-mono text-xs text-teal-900 dark:bg-teal-950/40 dark:text-teal-200">
						{flash}
					</p>
				) : null}

				<dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-9">
					{[
						['在租', String(live)],
						['成交', String(state.metrics.leased)],
						['SET NX 拒绝', String(state.metrics.lockHeld)],
						['已售', String(state.metrics.sold)],
						['限流', String(state.metrics.rateLimited)],
						['CAS', String(state.metrics.casConflict)],
						['到期', String(state.metrics.expired)],
						['缓存命中', String(hits)],
						['流水', fenYuan(billed)]
					].map(([label, value]) => (
						<div
							key={label}
							className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/60"
						>
							<dt className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">
								{label}
							</dt>
							<dd className="mt-0.5 font-mono text-sm text-zinc-900 dark:text-zinc-100">
								{value}
							</dd>
						</div>
					))}
				</dl>

				<div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
					<table className="min-w-[720px] w-full border-collapse text-sm">
						<thead>
							<tr className="bg-zinc-100/80 text-left font-mono text-[11px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80">
								<th className="px-3 py-2 font-medium">设备 / SKU</th>
								{HOURS.map((hour) => (
									<th key={hour} className="px-2 py-2 font-medium">
										{hour}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{state.devices.map((device) => (
								<tr
									key={device.id}
									className="border-t border-zinc-200 dark:border-zinc-800"
								>
									<td className="px-3 py-2 align-top">
										<p className="font-medium text-zinc-900 dark:text-zinc-100">
											{device.name}
										</p>
										<p className="font-mono text-[11px] text-zinc-500">
											{device.sku} · {device.cu} CU ·{' '}
											{fenYuan(device.priceFenPerHour)}/h
										</p>
									</td>
									{HOURS.map((hour) => {
										const slotId = `${device.id}:${hour}`;
										const slot = state.slots.find((item) => item.id === slotId);
										if (!slot) return null;
										const mine = slot.tenantId === tenantId;
										const left = slot.leaseUntil
											? Math.max(0, Math.ceil((slot.leaseUntil - now) / 1000))
											: 0;
										return (
											<td key={slotId} className="px-2 py-2">
												<button
													type="button"
													onClick={() => {
														setPicked(slotId);
														void api('schedule', { deviceId: device.id });
														if (slot.status === 'AVAILABLE')
															void occupy(slotId);
													}}
													disabled={!!busy}
													className={cn(
														'w-full rounded-md border px-2 py-2 text-left font-mono text-[11px] transition',
														slot.status === 'AVAILABLE'
															? 'border-teal-700/20 bg-teal-50/80 text-teal-900 dark:bg-teal-950/30 dark:text-teal-200'
															: mine
																? 'border-amber-400/40 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
																: 'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
														picked === slotId && 'ring-2 ring-teal-400/70'
													)}
												>
													<div>
														{slot.status === 'AVAILABLE' ? '可租' : '在租'}
													</div>
													<div className="opacity-80">
														{slot.status === 'LEASED'
															? `${slot.tenantId} · ${left}s`
															: `v${slot.version} · ${fenYuan(priceFen(device))}`}
													</div>
												</button>
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div className="grid gap-4 lg:grid-cols-2">
					<section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
						<h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
							Redis MONITOR
						</h3>
						<ul className="mt-3 space-y-1 font-mono text-[11px] text-teal-800 dark:text-teal-300">
							{state.cmds.length === 0 ? (
								<li className="text-zinc-500">
									抢占后这里会出现 SET NX / ZADD / GET
								</li>
							) : (
								state.cmds.map((cmd, index) => (
									<li key={`${cmd}-${index}`}>{cmd}</li>
								))
							)}
						</ul>
					</section>
					<section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
						<h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
							账单 / 事件
						</h3>
						<ul className="mt-3 space-y-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
							{state.bills.slice(0, 4).map((bill) => (
								<li key={bill.id} className="flex justify-between">
									<span>
										{bill.tenantId} · {bill.slotId}
									</span>
									<span>{fenYuan(bill.fen)}</span>
								</li>
							))}
							{state.events.slice(0, 5).map((event, index) => (
								<li key={`${event.at}-${index}`}>
									{new Date(event.at).toLocaleTimeString('zh-CN', {
										hour12: false
									})}{' '}
									{event.message}
								</li>
							))}
						</ul>
					</section>
				</div>
			</div>
		</Container>
	);
}
