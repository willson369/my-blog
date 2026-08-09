import React from 'react';
import { ProjectCard } from './ProjectCard';

const projects: ProjectItem[] = [
	{
		id: 'sparkrpc',
		code: 'SR',
		name: 'SparkRPC',
		url: 'https://sparkrpc.vercel.app/',
		github: 'https://github.com/willson369/SparkRPC',
		description:
			'面向学习与小规模内部通信的轻量 RPC。用 Java 17 + Netty 4 自研二进制协议，把粘包半包、编解码、代理调用和心跳保活串成一条完整调用链。',
		highlights: [
			'自定义协议帧：Magic + Length Field，稳妥处理 TCP 粘包 / 半包',
			'JDK 动态代理封装 RequestId 与超时，支持同步 Future 调用',
			'心跳与空闲检测，异常连接自动摘除，连接可复用',
			'SPI 可插拔序列化，注册中心适配预留（直连 MVP → ZooKeeper）'
		],
		tags: ['Java 17', 'Netty 4', 'Custom Protocol', 'SPI']
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
