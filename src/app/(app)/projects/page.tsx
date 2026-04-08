import { Container } from '@/components/Container';
import { type Metadata } from 'next';
import { Projects } from './Projects';

const title = '我的项目';
// 这里修改了描述，加入了你的网址
const description =
	'这是我的个人博客项目，基于 Next.js 和 Tailwind CSS 搭建。你可以访问 https://my-blog-iota-five.vercel.app/ 查看演示。这里记录了我的学习过程以及一些好玩的实验性项目。';

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

				{/* 这里是你原本修改的文字 */}
				<p className="mt-6 text-base text-zinc-600 dark:text-zinc-400">
					<b>都是我的学习以及觉得好玩的沙雕项目</b>
				</p>

				{/* 👇 新增这一段代码，用来显示上面的 description 变量 */}
				<p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
					{description}
				</p>
			</header>

			<div className="mt-16 sm:mt-20">
				<Projects />
			</div>
		</Container>
	);
}

export const revalidate = 3600;
