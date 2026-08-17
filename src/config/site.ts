import type { SiteConfig } from '@/types/siteConfig';

const url = new URL(
	process.env.NODE_ENV === 'production'
		? 'https://my-blog-iota-five.vercel.app/'
		: 'http://localhost:3000'
);

export const baseSiteConfig: SiteConfig = {
	name: 'kevin | 学生开发者',
	description:
		'我是 Kevin，一名还在学校的开发者。日常用 AI 辅助写代码、做小产品，也持续补齐前端、工程化与基础功。这里记录真实踩坑、学习笔记和一点点成长轨迹。',
	url: url.href,
	ogImage: url.origin + '/og.png',
	metadataBase: '/',
	keywords: [
		'kevin',
		'blog',
		'前端',
		'开发者',
		'AI',
		'编程',
		'学习笔记',
		'学生开发者',
		'Next.js'
	],
	authors: 'kevin',
	email: 'zhangziliuqlu@gmail.com',
	authorsCN: 'kevin',
	authorsUrl: 'https://github.com/willson369',
	social: [
		{
			href: 'https://github.com/willson369',
			text: 'github',
			icon: 'GitHubIcon'
		},
		{
			href: 'zhangziliuqlu@gmail.com',
			text: '邮箱',
			icon: 'MailIcon'
		},
		{
			href: 'qq',
			text: 'QQ',
			isPicture: true,
			hide: true,
			icon: 'QqIcon'
		}
	],
	themeColors: [
		{ media: '(prefers-color-scheme: dark)', color: '#000212' },
		{ media: '(prefers-color-scheme: light)', color: '#fafafa' }
	],
	defaultNextTheme: 'system',
	icons: {
		icon: '/favicon.ico',
		shortcut: '/logo.png',
		apple: '/logo.png'
	},
	navigationItems: [
		{ href: '/', text: '首页' },
		{ href: '/posts', text: '博客' },
		{ href: '/projects', text: '项目' },
		{ href: '/about', text: '关于我' },
		{ href: '/feed.xml', text: 'rss' }
	],
	moreItems: {
		'/more': [
			{
				href: '/icon',
				text: '图标库'
			},
			{
				href: '/admin',
				text: '管理'
			}
		]
	},
	footerItems: [{ href: '/', text: '首页' }],
	locale: 'zh-CN',
	siteHostList: [
		'my-blog-iota-five.vercel.app',
		'my-blog-fd7m97tel-willson369s-projects.vercel.app'
	]
};

const siteMetadata: SiteConfig = {
	...baseSiteConfig,
	openGraph: {
		type: 'website',
		locale: baseSiteConfig.locale,
		url: baseSiteConfig.url,
		title: baseSiteConfig.name,
		description: baseSiteConfig.description,
		siteName: baseSiteConfig.name,
		images: [`${baseSiteConfig.url}og.png`]
	},
	twitter: {
		card: 'summary_large_image',
		title: baseSiteConfig.name,
		description: baseSiteConfig.description,
		images: [`${baseSiteConfig.url}og.png`],
		creator: '@kevin'
	}
};

export default siteMetadata;
