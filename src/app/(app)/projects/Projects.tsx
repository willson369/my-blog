import React from 'react';
import { ProjectCard } from './ProjectCard';

const projects: ProjectItem[] = [
	{
		id: 'distributed-compute-rental',
		code: 'DC',
		name: '算力分时调度',
		url: 'https://compute-lease.vercel.app',
		github: 'https://github.com/willson369/compute-lease',
		description:
			'服务端 Redis 高并发调度：SET NX 分布式锁、ZSET 延迟队列、滑动窗口限流、Caffeine+Redis 多级缓存。同一时段只能成交一次。',
		highlights: [
			'Redis SET NX PX 挡惊群；落库 version CAS 防超卖，万人同时点也不会超卖',
			'ZSET 到期队列 + pipeline 失效缓存；INCR 滑动窗口限流',
			'Upstash REST 无连接复用，Serverless 下不怕 1 万个函数一人一条 TCP',
			'一键 160 并发打同一 slot，成交必须是 1；MONITOR 能看见真实命令'
		],
		tags: ['Redis', 'SET NX', 'ZSET', '限流']
	},
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
	},
	{
		id: 'teamboard',
		code: 'TB',
		name: 'TeamBoard',
		url: 'https://teamboard-one.vercel.app',
		github: 'https://github.com/willson369/teamboard',
		description:
			'团队实时协作白板 MVP。多人同画布编辑，基于 Yjs CRDT 自动合并冲突，配合 Presence、邀请码进房与 Postgres 持久化。',
		highlights: [
			'Yjs CRDT：多人同时拖拽便签也不互相覆盖',
			'邀请码 / 链接进房，Owner / Editor / Viewer 角色分离',
			'Awareness 呈现光标、头像与选中态，刷新后画布可恢复',
			'Next.js + Prisma + Postgres；WS 独立部署，适配 Vercel 长连接限制'
		],
		tags: ['Next.js', 'Yjs', 'WebSocket', 'Postgres']
	},
	{
		id: 'heigen',
		code: 'HG',
		name: '黑根',
		url: 'https://willson369-refactored-potato.vercel.app',
		github: 'https://github.com/willson369/Startup-Consultant-Heigen',
		description:
			'创业计划指导顾问。把模糊想法推进成经得起评委追问的商业逻辑：验证想法、梳理 BP、准备路演、模拟答辩四条工作流。',
		highlights: [
			'四模式顾问：验证想法 / 梳理 BP / 准备路演 / 模拟答辩',
			'分步进度条引导：先钉死用户与问题，再谈方案与叙事',
			'右侧项目看板沉淀目标用户、核心问题、证据与下一验证',
			'支持会话导出与本地记录清理；可接后端持久化与联网检索'
		],
		tags: ['AI 顾问', '创业', '产品交互', '前端']
	},
	{
		id: 'shenlun-ai',
		code: 'SL',
		name: '申论 AI 批改',
		url: 'https://shenlun-ai-production.up.railway.app',
		description:
			'提交题干与作文，异步返回综合得分、维度诊断与可执行修改计划。面向立意、结构、论证、语言四维打分，而不是只给一句空泛评语。',
		highlights: [
			'DeepSeek 驱动：立意 / 结构 / 论证 / 语言分项评分',
			'总评 + 主要问题 + 修改计划，输出可直接落地的改写路径',
			'支持目标分设定与字数统计，批改过程异步可追踪',
			'展示 token 消耗、时延与模型信息，方便排查与演示'
		],
		tags: ['AI 批改', 'DeepSeek', '教育工具', '异步任务']
	},
	{
		id: 'pixelvault',
		code: 'PV',
		name: 'PixelVault',
		url: 'https://pixelvault-nu.vercel.app',
		github: 'https://github.com/willson369/pixelvault',
		description:
			'小团队 AI 素材库。图片直存腾讯云 COS，AI 自动打标与语义搜索，支持团队空间与分享链接，文件不落本地盘。',
		highlights: [
			'上传 jpg / png / webp 直达腾讯云 COS',
			'AI 自动生成标题、标签与向量（Mock / OpenAI 可切换）',
			'关键词 + 语义双通道检索，素材更好找',
			'团队 owner / member 权限与分享链接；Next.js + Prisma + PostgreSQL'
		],
		tags: ['Next.js', 'COS', 'PostgreSQL', '语义搜索']
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
