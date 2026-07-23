import blogIcon from '~/public/logo.png';
import React from 'react';
import { ProjectCard } from './ProjectCard';

export function Projects(): React.ReactElement {
	// 作品区后续会慢慢补；先保留博客本体作为可访问的作品入口
	const projects: ProjectItem[] = [
		{
			id: '1',
			url: 'https://my-blog-iota-five.vercel.app/',
			icon: blogIcon,
			name: '个人博客',
			description:
				'基于 Next.js、Contentlayer 与 Tailwind CSS 搭建的个人站点，用来沉淀学习笔记与工程复盘。更多项目会陆续补上。',
			tags: ['Next.js', 'TypeScript', '进行中']
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
