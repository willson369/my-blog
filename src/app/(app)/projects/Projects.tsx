import luckySnailBlogIcon from '~/public/logo.png'; // 确保这个路径指向你博客的 logo
import React from 'react';
import { ProjectCard } from './ProjectCard';

export function Projects(): React.ReactElement {
	// 只保留一个项目：你的博客
	const projects: ProjectItem[] = [
		{
			id: '1',
			url: 'https://my-blog-iota-five.vercel.app/', // 替换成你实际的域名或 GitHub Pages 链接
			icon: luckySnailBlogIcon,
			name: '我的个人博客',
			description:
				'基于 Next.js 和 Tailwind CSS 从零搭建的静态博客，实现了 SSR 渲染和自定义主题切换。',
			tags: ['个人', 'Next.js'] // 这里可以写你用到的技术
		}
	];

	return (
		<ul
			role="list"
			className="grid grid-cols-1 gap-x-12 gap-y-16 sm:grid-cols-2 lg:grid-cols-3"
		>
			{projects.map((project) => (
				<ProjectCard project={project} key={project.id} />
			))}
		</ul>
	);
}
