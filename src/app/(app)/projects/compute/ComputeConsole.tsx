'use client';

import { cn } from '@/lib/utils';
import {
	createLeaseRuntime,
	DEVICES,
	priceFen,
	SLOT_MS,
	TENANTS,
	type ClusterState,
	type LeaseRuntime
} from '@/lib/lease-engine';
import React from 'react';

function fenYuan(fen: number) {
	return `¥${(fen / 100).toFixed(2)}`;
}

function remain(leaseUntil: number | null, now: number) {
	if (!leaseUntil) return '';
	const ms = leaseUntil - now;
	if (ms <= 0) return '到期中';
	return `${Math.ceil(ms / 1000)}s`;
}

export function ComputeConsole() {
	const runtimeRef = React.useRef<LeaseRuntime | null>(null);
	const [ready, setReady] = React.useState(false);
	const [now, setNow] = React.useState(() => Date.now());
	const [tenantId, setTenantId] = React.useState(TENANTS[0]?.id ?? 'spark');
	const [state, setState] = React.useState<ClusterState | null>(null);
	const [busy, setBusy] = React.useState<string | null>(null);
	const [flash, setFlash] = React.useState<string>('');
	const [picked, setPicked] = React.useState<string>('gpu-a100:10:00');

	React.useEffect(() => {
		const runtime = createLeaseRuntime();
		runtimeRef.current = runtime;
		const pull = () => setState(runtime.snapshot());
		pull();
		setReady(true);
		const unsub = runtime.subscribe(pull);
		const clock = window.setInterval(() => {
			setNow(Date.now());
			pull();
		}, 250);
		return () => {
			unsub();
			window.clearInterval(clock);
			runtime.dispose();
			runtimeRef.current = null;
		};
	}, []);

	const occupy = async (slotId: string) => {
		const runtime = runtimeRef.current;
		if (!runtime || busy) return;
		setBusy(slotId);
		const result = await runtime.occupy(slotId, tenantId);
		setFlash(result.ok ? `成交 ${slotId}` : `未抢到：${result.reason}`);
		setBusy(null);
	};

	const storm = async () => {
		const runtime = runtimeRef.current;
		if (!runtime || busy || !state) return;
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
		const result = await runtime.storm(target.id, 160);
		setFlash(
			`160 并发抢 ${target.id} → 成交 ${result.leased} ${Object.entries(
				result.reasons
			)
				.map(([key, value]) => `${key} ${value}`)
				.join(' / ')}`
		);
		setBusy(null);
	};

	if (!ready || !state) {
		return (
			<div className="rounded-xl border border-zinc-200 px-4 py-10 text-center font-mono text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
				正在拉起调度内核…
			</div>
		);
	}

	const hours = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
	const billed = state.bills.reduce((sum, bill) => sum + bill.fen, 0);
	const live = state.slots.filter((slot) => slot.status === 'LEASED').length;

	return (
		<div className="space-y-5">
			<section className="overflow-hidden rounded-xl border border-teal-700/20 bg-zinc-950 text-zinc-100 shadow-lg">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
					<div>
						<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal-300/90">
							lease kernel · node {runtimeRef.current?.nodeId}
						</p>
						<h2 className="mt-1 text-base font-semibold tracking-tight sm:text-lg">
							算力分时调度台
						</h2>
					</div>
					<p className="max-w-md text-xs leading-relaxed text-zinc-400">
						1 时段演示 {SLOT_MS / 1000}s。多标签页 = 多节点；Web Lock
						互斥，version CAS 防超卖，到期扫单扣费。
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
							{TENANTS.map((tenant) => (
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
						onClick={() =>
							window.open(window.location.href, '_blank', 'noopener,noreferrer')
						}
						className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:border-teal-300/40"
					>
						打开第二节点
					</button>
					<button
						type="button"
						onClick={() => runtimeRef.current?.reset()}
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

			<dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
				{[
					['在租', String(live)],
					['成交', String(state.metrics.leased)],
					['锁拒绝', String(state.metrics.lockHeld)],
					['已售', String(state.metrics.sold)],
					['CAS 冲突', String(state.metrics.casConflict)],
					['到期扣费', String(state.metrics.expired)],
					['缓存命中', String(state.metrics.localHit + state.metrics.redisHit)],
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
							{hours.map((hour) => (
								<th key={hour} className="px-2 py-2 font-medium">
									{hour}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{DEVICES.map((device) => (
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
									<p className="text-[11px] text-zinc-500">
										{device.vcpu} vCPU
										{device.vramGb ? ` · ${device.gpu} ${device.vramGb}G` : ''}
									</p>
								</td>
								{hours.map((hour) => {
									const slotId = `${device.id}:${hour}`;
									const slot = state.slots.find((item) => item.id === slotId);
									if (!slot) return null;
									const mine = slot.tenantId === tenantId;
									const selected = picked === slotId;
									return (
										<td key={slotId} className="px-2 py-2">
											<button
												type="button"
												onClick={() => {
													setPicked(slotId);
													runtimeRef.current?.schedule(device.id);
													if (slot.status === 'AVAILABLE') void occupy(slotId);
												}}
												disabled={!!busy}
												className={cn(
													'w-full rounded-md border px-2 py-2 text-left font-mono text-[11px] transition',
													slot.status === 'AVAILABLE'
														? 'border-teal-700/20 bg-teal-50/80 text-teal-900 hover:border-teal-500 dark:bg-teal-950/30 dark:text-teal-200'
														: mine
															? 'border-amber-400/40 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
															: 'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
													selected && 'ring-2 ring-teal-400/70'
												)}
											>
												<div>
													{slot.status === 'AVAILABLE' ? '可租' : '在租'}
												</div>
												<div className="opacity-80">
													{slot.status === 'LEASED'
														? `${slot.tenantId} · ${remain(slot.leaseUntil, now)}`
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
						账单
					</h3>
					<ul className="mt-3 space-y-2">
						{state.bills.length === 0 ? (
							<li className="text-sm text-zinc-500">
								到期后自动入账，可重放不重复扣。
							</li>
						) : (
							state.bills.slice(0, 8).map((bill) => (
								<li
									key={bill.id}
									className="flex justify-between gap-3 font-mono text-xs text-zinc-700 dark:text-zinc-300"
								>
									<span>
										{bill.tenantId} · {bill.slotId}
									</span>
									<span>{fenYuan(bill.fen)}</span>
								</li>
							))
						)}
					</ul>
				</section>
				<section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
					<h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
						事件
					</h3>
					<ul className="mt-3 space-y-2">
						{state.events.slice(0, 8).map((event, index) => (
							<li
								key={`${event.at}-${index}`}
								className="font-mono text-xs leading-relaxed text-zinc-600 dark:text-zinc-400"
							>
								<span className="text-teal-700 dark:text-teal-300">
									{new Date(event.at).toLocaleTimeString('zh-CN', {
										hour12: false
									})}
								</span>{' '}
								{event.message}
							</li>
						))}
					</ul>
				</section>
			</div>

			<p className="text-xs leading-relaxed text-zinc-500">
				度量按云厂商 SKU：CU = vCPU + GPU 权重，价格按卡时。脑裂以 version
				为准，锁只挡惊群。这是调度内核演示，不是机房托管。
			</p>
		</div>
	);
}
