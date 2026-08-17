import { constructSiteUrl } from '@/lib';
import { getBlogPosts } from '@/lib/posts';
import { type MetadataRoute } from 'next';

export function generateStaticParams() {
	return [{ __metadata_id__: [] }];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const staticMap = [
		{
			url: constructSiteUrl('/').href,
			lastModified: new Date()
		},
		{
			url: constructSiteUrl('/posts').href,
			lastModified: new Date()
		},
		{
			url: constructSiteUrl('/projects').href,
			lastModified: new Date()
		},
		{
			url: constructSiteUrl('/projects/compute').href,
			lastModified: new Date()
		},
		{
			url: constructSiteUrl('/about').href,
			lastModified: new Date()
		}
	] satisfies MetadataRoute.Sitemap;

	const dynamicMap = getBlogPosts().map((post) => ({
		url: constructSiteUrl(`/posts/${post.slug}`).href,
		lastModified: new Date(post.date)
	})) satisfies MetadataRoute.Sitemap;

	return [...staticMap, ...dynamicMap];
}
