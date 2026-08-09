'use client';

import { ExternalLinkIcon, GitHubIcon } from '@/assets';
import {
	AnimatePresence,
	motion,
	useMotionTemplate,
	useMotionValue
} from 'framer-motion';
import React from 'react';

export function ProjectCard({
	project,
	index
}: {
	project: ProjectItem;
	index: number;
}) {
	const { url, github, name, tags, description, highlights, code } = project;

	const mouseX = useMotionValue(0);
	const mouseY = useMotionValue(0);
	const radius = useMotionValue(0);
	const handleMouseMove = React.useCallback(
		({ clientX, clientY, currentTarget }: React.MouseEvent) => {
			const bounds = currentTarget.getBoundingClientRect();
			mouseX.set(clientX - bounds.left);
			mouseY.set(clientY - bounds.top);
			radius.set(Math.sqrt(bounds.width ** 2 + bounds.height ** 2) / 2.2);
		},
		[mouseX, mouseY, radius]
	);
	const maskBackground = useMotionTemplate`radial-gradient(circle ${radius}px at ${mouseX}px ${mouseY}px, black 35%, transparent)`;
	const [isHovering, setIsHovering] = React.useState(false);
	const host = new URL(url).host;
	const order = String(index + 1).padStart(2, '0');

	return (
		<li
			className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-800/10 bg-zinc-50/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition dark:border-teal-400/15 dark:bg-zinc-950/70 dark:shadow-[inset_0_1px_0_rgba(45,212,191,0.08)] sm:p-6"
			onMouseEnter={() => setIsHovering(true)}
			onMouseMove={handleMouseMove}
			onMouseLeave={() => setIsHovering(false)}
		>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-40"
				style={{
					backgroundImage:
						'linear-gradient(to right, rgba(15,118,110,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,118,110,0.08) 1px, transparent 1px)',
					backgroundSize: '18px 18px'
				}}
			/>

			<div className="relative z-10 flex items-start justify-between gap-3">
				<div className="flex h-12 w-12 items-center justify-center rounded-lg border border-teal-700/30 bg-zinc-900 font-mono text-sm font-semibold tracking-wider text-teal-300 shadow-inner dark:border-teal-400/30 dark:bg-black">
					{code}
				</div>
				<span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
					#{order}
				</span>
			</div>

			<a
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				className="relative z-10 mt-5 block"
			>
				<h2 className="text-xl font-semibold tracking-tight text-zinc-900 transition group-hover:text-teal-700 dark:text-zinc-50 dark:group-hover:text-teal-300">
					{name}
				</h2>
			</a>

			<p className="relative z-10 mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
				{description}
			</p>

			<div className="relative z-10 mt-5">
				<p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-teal-700/80 dark:text-teal-300/80">
					:: highlights
				</p>
				<ul className="space-y-2">
					{highlights.map((item) => (
						<li
							key={item}
							className="flex gap-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
						>
							<span className="mt-0.5 shrink-0 font-mono text-teal-600 dark:text-teal-400">
								&gt;
							</span>
							<span>{item}</span>
						</li>
					))}
				</ul>
			</div>

			<div className="relative z-10 mt-5 flex flex-wrap gap-2">
				{tags.map((tag) => (
					<span
						key={tag}
						className="rounded border border-zinc-300/80 bg-white/70 px-2 py-0.5 font-mono text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300"
					>
						{tag}
					</span>
				))}
			</div>

			<div className="relative z-10 mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-6 text-sm">
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 font-medium text-teal-700 transition hover:text-teal-600 dark:text-teal-300 dark:hover:text-teal-200"
				>
					<span className="truncate">{host}</span>
					<ExternalLinkIcon className="h-4 w-4 shrink-0" />
				</a>
				{github ? (
					<a
						href={github}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
					>
						<GitHubIcon className="h-4 w-4" />
						<span>源码</span>
					</a>
				) : null}
			</div>

			<AnimatePresence>
				{isHovering && (
					<motion.div
						className="pointer-events-none absolute inset-0 z-0"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						style={{
							WebkitMaskImage: maskBackground,
							maskImage: maskBackground
						}}
					>
						<div className="absolute inset-0 bg-gradient-to-br from-teal-400/10 via-transparent to-cyan-400/10" />
						<div className="absolute inset-0 border border-teal-500/30 sm:rounded-xl" />
					</motion.div>
				)}
			</AnimatePresence>
		</li>
	);
}
