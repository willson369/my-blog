import { allPosts, type Post } from 'contentlayer/generated';

/** About lives on /about; keep it out of the blog timeline & prev/next. */
const HIDDEN_FROM_BLOG = new Set(['about']);

function byDateDesc(a: Post, b: Post) {
	return new Date(b.date).getTime() - new Date(a.date).getTime();
}

/** Immutable, date-desc list of every content document. */
export function getAllPostsSorted(): Post[] {
	return allPosts.slice().sort(byDateDesc);
}

/** Blog-facing posts only (excludes about page content). */
export function getBlogPosts(): Post[] {
	return getAllPostsSorted().filter((post) => !HIDDEN_FROM_BLOG.has(post.slug));
}

export function getPostBySlug(slug: string): Post | undefined {
	return allPosts.find((post) => post.slug === slug);
}

export function getAdjacentPosts(slug: string): {
	post: Post | undefined;
	prevPost: Post | undefined;
	nextPost: Post | undefined;
} {
	const posts = getBlogPosts();
	const index = posts.findIndex((post) => post.slug === slug);

	if (index === -1) {
		return {
			post: getPostBySlug(slug),
			prevPost: undefined,
			nextPost: undefined
		};
	}

	return {
		post: posts[index],
		// newer posts are earlier in the list
		prevPost: posts[index + 1],
		nextPost: posts[index - 1]
	};
}
