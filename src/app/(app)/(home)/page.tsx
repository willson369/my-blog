import { Container } from '@/components/Container';
import { Headline } from '@/components/IndexHeader';
import { getBlogPosts } from '@/lib/posts';
import dayjs from 'dayjs';
import Link from 'next/link';

export default function Home() {
	const latestPosts = getBlogPosts().slice(0, 3);

	return (
		<Container className="mt-10 min-h-[40vh]">
			<Headline />
			<section className="mt-16 max-w-3xl">
				<div className="mb-4 flex items-end justify-between gap-4">
					<h2 className="text-lg font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
						最近在写
					</h2>
					<Link
						href="/posts"
						className="text-sm text-teal-700 transition hover:underline dark:text-teal-300"
					>
						查看全部 →
					</Link>
				</div>
				<ul className="space-y-4">
					{latestPosts.map((post) => (
						<li key={post.slug}>
							<Link
								href={`/posts/${post.slug}`}
								className="group block border-b border-zinc-200/80 pb-4 transition dark:border-zinc-700/60"
							>
								<p className="text-xs uppercase tracking-wide text-zinc-500">
									{dayjs(post.date).format('YYYY-MM-DD')}
								</p>
								<p className="mt-1 text-base font-medium text-zinc-800 transition group-hover:text-teal-700 dark:text-zinc-100 dark:group-hover:text-teal-300">
									{post.title}
								</p>
								{post.description ? (
									<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
										{post.description}
									</p>
								) : null}
							</Link>
						</li>
					))}
				</ul>
			</section>
		</Container>
	);
}
