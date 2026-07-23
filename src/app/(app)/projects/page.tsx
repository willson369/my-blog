import { Container } from '@/components/Container';
import { type Metadata } from 'next';
import { Projects } from './Projects';

const title = '作品与实验';
const description =
	'这里会陆续放上我做过的项目与实验。目前先从博客本体开始，后续会按完成度逐步补充。';

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
			<header className="max-w-2xl">
				<h1 className="text-4xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100 sm:text-5xl">
					{title}
				</h1>
				<p className="mt-6 text-base text-zinc-600 dark:text-zinc-400">
					不急着堆项目卡片。我想先把真正做过、能讲清楚的东西整理好，再慢慢补齐这一页。
				</p>
			</header>

			<div className="mt-16 sm:mt-20">
				<Projects />
			</div>
		</Container>
	);
}

export const revalidate = 3600;
