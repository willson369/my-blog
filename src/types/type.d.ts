// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyIfEmpty = any;

interface ProjectItem {
	id: string;
	name: string;
	url: string;
	github?: string;
	description: string;
	highlights: string[];
	/** Short code-like label shown in the monogram, e.g. SR / NFT */
	code: string;
	tags: string[];
	icon?: StaticImageData;
}
