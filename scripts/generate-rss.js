/* eslint-disable */
const { promises: fs } = require('fs');
const path = require('path');
const RSS = require('rss');
const matter = require('gray-matter');

const SITE_URL = 'https://my-blog-iota-five.vercel.app';

async function generate() {
	const feed = new RSS({
		title: 'kevin | blog',
		description:
			'Kevin 的技术博客：记录 AI 辅助开发、前端工程与学习路上的真实踩坑与复盘。',
		site_url: SITE_URL,
		feed_url: `${SITE_URL}/feed.xml`
	});

	const folders = [
		path.join(__dirname, '..', 'data', 'blog'),
		path.join(__dirname, '..', 'posts')
	];

	const allFiles = await Promise.all(
		folders.map(async (folder) => {
			try {
				const files = await fs.readdir(folder);
				return files
					.filter((file) => /\.mdx?$/.test(file))
					.map((file) => ({ file, folder }));
			} catch {
				return [];
			}
		})
	);

	const items = [];

	await Promise.all(
		allFiles.flat().map(async ({ file, folder }) => {
			const content = await fs.readFile(path.join(folder, file));
			const frontmatter = matter(content);
			const data = frontmatter.data || {};

			if (!data.title || data.slug === 'about') return;

			const slug = String(data.slug || file.replace(/\.mdx?$/, '')).trim();
			items.push({
				title: data.title,
				url: `${SITE_URL}/posts/${slug}`,
				date: data.date,
				description: data.description || data.summary || data.title
			});
		})
	);

	items
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
		.forEach((item) => feed.item(item));

	await fs.writeFile('./public/feed.xml', feed.xml({ indent: true }));
}

module.exports = generate;
