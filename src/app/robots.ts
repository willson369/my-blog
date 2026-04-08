import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: 'Googlebot',
				allow: '/'
			},
			{
				userAgent: 'Applebot',
				allow: '/'
			},
			{
				userAgent: 'bingbot',
				allow: '/'
			},
			{
				userAgent: 'Baiduspider',
				allow: '/'
			},
			{
				userAgent: '*',
				allow: '/'
			}
		]
	};
}
