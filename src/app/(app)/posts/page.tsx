import { Container } from '@/components/Container';
import { getBlogPosts } from '@/lib/posts';
import CoverSwitch from './CoverSwitch';
import { PostsTimeline } from './PostsTimeline';

const title = '我的博客列表 | ';
const description = '记录编程学习、AI 辅助开发与工程实践中的问题、方法和感受。';

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
};

export default function Posts() {
	const sortedPosts = getBlogPosts();

	return (
		<Container className="min-h-[50vh] mt-16">
			<header className="mb-6 max-w-2xl">
				<div className="flex items-center gap-3">
					<h1 className="text-xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100 sm:text-xl">
						博客
					</h1>
					<span className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
						{sortedPosts.length} 篇
					</span>
					<CoverSwitch />
				</div>
				<p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
					主要写 <b>AI 开发体验</b> 与 <b>前端 / 工程化</b>
					，也会偶尔记下学习路上的想法。
				</p>
			</header>
			<PostsTimeline posts={sortedPosts} />
		</Container>
	);
}
