import { ExternalLinkIcon, GitHubIcon } from '@/assets';
import { Container } from '@/components/Container';
import { type Metadata } from 'next';
import { Projects } from './Projects';

const title = '作品与实验';
const description =
	'这里放我亲手做过、能讲清楚的项目：基础设施、链上应用与完整前端产品。笔记写在博客，作品在这里。';

export const metadata = {
	title,
	description,
	openGraph: {
		title,
		description
	},
	twitter: {
		title,
		description,
		card: 'summary_large_image'
	}
} satisfies Metadata;

export default function ProjectsPage() {
	return (
		<Container className="mt-16 sm:mt-32">
			<header className="max-w-3xl">
				<p className="font-mono text-xs uppercase tracking-[0.22em] text-teal-700 dark:text-teal-300">
					kevin@works:~$ ls ./projects
				</p>
				<h1 className="mt-3 text-4xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100 sm:text-5xl">
					{title}
				</h1>
				<p className="mt-6 text-base text-zinc-600 dark:text-zinc-400">
					三个可演示项目，各自负责不同能力切片：网络协议、智能合约、产品交互。
					下面是深挖版；如果你想先快速扫一圈，也可以去简历作品站。
				</p>
			</header>

			{/* 简历作品站：合集入口，不与博客抢定位 */}
			<aside className="relative mt-10 overflow-hidden rounded-xl border border-teal-700/20 bg-gradient-to-br from-zinc-900 via-zinc-900 to-teal-950 p-5 text-zinc-100 shadow-lg sm:p-6">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 opacity-30"
					style={{
						backgroundImage:
							'linear-gradient(to right, rgba(45,212,191,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(45,212,191,0.15) 1px, transparent 1px)',
						backgroundSize: '22px 22px'
					}}
				/>
				<div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="max-w-2xl">
						<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal-300/90">
							portfolio hub · resume optimized
						</p>
						<h2 className="mt-2 text-lg font-semibold tracking-tight sm:text-xl">
							简历作品站
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-zinc-300">
							为投递简历单独做的三项目合集展示页：更适合 HR / 面试官快速浏览。
							本页则保留更完整的技术简介与亮点拆解。两边互补，不互相替代。
						</p>
					</div>
					<a
						href="https://portfolio-liart-nine-2apyehqsff.vercel.app/"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-teal-300/40 bg-teal-400/10 px-4 py-2.5 text-sm font-medium text-teal-200 transition hover:bg-teal-400/20"
					>
						打开作品站
						<ExternalLinkIcon className="h-4 w-4" />
					</a>
				</div>
				<p className="relative z-10 mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-zinc-400">
					<span>demo · 3 projects</span>
					<a
						href="https://github.com/willson369"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 transition hover:text-teal-200"
					>
						<GitHubIcon className="h-3.5 w-3.5" />
						github.com/willson369
					</a>
				</p>
			</aside>

			<div className="mt-12 sm:mt-14">
				<div className="mb-6 flex items-end justify-between gap-4">
					<div>
						<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
							selected builds
						</p>
						<h2 className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
							项目深挖
						</h2>
					</div>
					<span className="font-mono text-xs text-zinc-400">3 entries</span>
				</div>
				<Projects />
			</div>
		</Container>
	);
}

export const revalidate = 3600;
