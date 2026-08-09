import React from 'react';
import { ProjectCard } from './ProjectCard';

const projects: ProjectItem[] = [
	{
		id: 'hongbi',
		code: 'HB',
		name: '红笔',
		url: 'https://hongbi-production.up.railway.app',
		github: 'https://github.com/willson369/MyHongBi',
		description:
			'视频一键变小红书爆款笔记。先提炼口播主旨，再按品类爆款模板施工，输出可直接发布的笔记卡，并把网感分做成看得见的创作反馈。',
		highlights: [
			'主旨提炼 → 模板施工 → 笔记卡预览：完整内容生产线，不是简单转写',
			'10 套品类施工模板（职场吐槽 / 种草带货 / 干货知识等），含结构步骤与范文',
			'规则网感分 0–100：低分自动去 AI 味改写，可解释、可迭代',
			'支持抖音 / B站 / YouTube / 小红书链接，可选粘贴个人爆款作风格参考'
		],
		tags: ['Python', 'AI 应用', 'OpenRouter', '内容工具']
	},
	{
		id: 'subscription-nft',
		code: 'NFT',
		name: 'Subscription NFT',
		url: 'https://frontend-rouge-five-audfjlox8o.vercel.app/#demo',
		github: 'https://github.com/willson369/subscription-nft',
		description:
			'可升级、不可转让的链上订阅会员系统。付款铸造会员凭证，续费只延长有效期，过期后权益自动失效——把一次付款变成可验证的链上权益。',
		highlights: [
			'UUPS Proxy：逻辑与数据分离，升级无需迁移资产',
			'Soulbound 设计：禁止转让，避免会员资格被二级市场倒卖',
			'精确时间逻辑：未过期从原到期日累加，过期后从当前时间重启',
			'角色权限分层 + 9 项自动化合约测试覆盖核心状态流转'
		],
		tags: ['Solidity', 'UUPS', 'Soulbound', 'Web3']
	},
	{
		id: 'random-tarot',
		code: 'TR',
		name: '星河问卜',
		url: 'https://random-tarot-lake.vercel.app/',
		github: 'https://github.com/willson369/random-tarot-oracle',
		description:
			'全流程塔罗占问应用：选题型 → 选牌阵 → 提问 → 抽牌 → 生成解读。把“趣味交互”和“可执行建议”接到同一条产品链路里。',
		highlights: [
			'17+ 套牌阵，按用途 / 难度 / 张数过滤，并支持智能推荐',
			'手动点选与老虎机两种抽牌方式，强化仪式感与可玩性',
			'输出聚焦现状判断、阻力点与下一步行动，而不是空泛运势',
			'Next.js + Chakra UI 搭建成可直接演示的完整前端产品'
		],
		tags: ['Next.js', 'Chakra UI', '交互产品', '前端']
	}
];

export function Projects(): React.ReactElement {
	return (
		<ul role="list" className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
			{projects.map((project, index) => (
				<ProjectCard project={project} index={index} key={project.id} />
			))}
		</ul>
	);
}
