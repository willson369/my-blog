import { Container } from '@/components/Container';
import { type Metadata } from 'next';
import { ComputeConsole } from './ComputeConsole';

const title = '算力分时调度台';
const description =
	'同一设备同一时段只能成交一次。短 TTL 多级缓存、分布式锁、version 乐观锁、到期自动扣费。';

export const metadata = {
	title,
	description,
	openGraph: { title, description },
	twitter: { title, description, card: 'summary_large_image' }
} satisfies Metadata;

export default function ComputePage() {
	return (
		<Container className="mt-16 sm:mt-24">
			<header className="max-w-3xl">
				<p className="font-mono text-xs uppercase tracking-[0.22em] text-teal-700 dark:text-teal-300">
					kevin@cluster:~$ watch slots
				</p>
				<h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100 sm:text-4xl">
					{title}
				</h1>
				<p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
					点格子即抢占。先点「160 并发抢同一 slot」看超卖是否被挡住，再等 12
					秒看到期扣费。新开一个标签页就是第二个调度节点。
				</p>
			</header>
			<div className="mt-10">
				<ComputeConsole />
			</div>
		</Container>
	);
}
