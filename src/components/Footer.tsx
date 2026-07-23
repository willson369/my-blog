import { PeekabooLink } from '@/components/links/PeekabooLink';
import siteMetadata from '@/config/site';
import Link from 'next/link';
import React from 'react';
import { Container } from './Container';

const navigationItems = siteMetadata.navigationItems;

function NavLink({
	href,
	children
}: {
	href: string;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			className="transition hover:text-teal-600 dark:hover:text-teal-300"
		>
			{children}
		</Link>
	);
}

function Links() {
	return (
		<nav className="flex gap-6 text-sm font-medium text-zinc-800 dark:text-zinc-200">
			{navigationItems.map(({ href, text }) => (
				<NavLink key={href} href={href}>
					{text}
				</NavLink>
			))}
		</nav>
	);
}

export function Footer() {
	return (
		<footer className="mt-32">
			<Container.Outer>
				<div className="border-t border-zinc-100 pb-16 pt-10 dark:border-zinc-700/40">
					<Container.Inner>
						<div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
							<p className="text-sm text-zinc-500/80 dark:text-zinc-400/80">
								&copy; {new Date().getFullYear()} {siteMetadata.authorsCN}
								&nbsp;· 网站已开源：
								<PeekabooLink href="https://github.com/willson369/my-blog">
									kevin
								</PeekabooLink>
							</p>
							<Links />
						</div>
					</Container.Inner>
					<Container.Inner className="mt-6">
						<div className="flex flex-col items-center justify-start gap-2 sm:flex-row text-sm text-zinc-500 dark:text-zinc-400">
							欢迎来看，也欢迎交流学习
						</div>
					</Container.Inner>
				</div>
			</Container.Outer>
		</footer>
	);
}
