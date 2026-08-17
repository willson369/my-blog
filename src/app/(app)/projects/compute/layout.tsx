import { type Metadata } from 'next';
import { type ReactNode } from 'react';

const title = '算力分时调度台';
const description =
	'Redis SET NX 分布式锁、ZSET 延迟队列、滑动窗口限流、Caffeine+Redis 多级缓存。同一时段只能成交一次。';

export const metadata = {
	title,
	description,
	openGraph: { title, description },
	twitter: { title, description, card: 'summary_large_image' }
} satisfies Metadata;

export default function ComputeLayout({ children }: { children: ReactNode }) {
	return children;
}
