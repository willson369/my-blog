// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// 🔥 关键修改：硬编码测试
const GH_USER = 'willson369';
const GH_PROJECT_NAME = 'my-blog';
const GH_TOKEN = process.env.GH_TOKEN; // 只有 Token 从环境变量读取

console.log('=== 🚀 硬编码测试版本 ===');
console.log('用户名:', GH_USER);
console.log('仓库名:', GH_PROJECT_NAME);
console.log('Token 存在:', !!GH_TOKEN);
console.log('Token 前几位:', GH_TOKEN ? GH_TOKEN.substring(0, 10) + '...' : '无');

if (!GH_TOKEN) {
	console.error('❌ 错误：GH_TOKEN 未设置！');
	console.error('请在 GitHub Secrets 中设置 GH_TOKEN');
	process.exit(-1);
}

// 清理 Token
const cleanToken = (GH_TOKEN || '').toString()
  .replace(/\r/g, '')
  .replace(/\n/g, '')
  .trim();

console.log('清理后 Token 长度:', cleanToken.length);

// 创建 axios 实例
const api = axios.create({
	baseURL: 'https://api.github.com',
	headers: {
		'Authorization': `Bearer ${cleanToken}`,
		'Accept': 'application/vnd.github.v3+json',
		'User-Agent': 'Node.js-GitHub-Sync',
		'X-GitHub-Api-Version': '2022-11-28'
	},
	timeout: 10000
});

const blogOutputPath = '../../data/blog';

// 如果是 img 标签，并且没有闭合，那么就拼接闭合字符
function closeImgTag(htmlString) {
	const imgTagRegex = /<img([^>]*)(?<!\/)>/g;
	return htmlString.replace(imgTagRegex, '<img$1 />');
}

function generateMdx(issue, fileName) {
	const { title, labels = [], created_at, body = '', html_url, user } = issue;
	return `---
title: ${title.trim()}
date: ${created_at}
slug: ${fileName}
author: ${user?.login}：${user?.html_url}
tags: ${JSON.stringify(labels.map((item) => item.name))}
---

${closeImgTag((body || '').replace(/<br \/>/g, '\n'))}

---
此文自动发布于：<a href="${html_url}" target="_blank">github issues</a>
`;
}

async function main() {
	const filePath = path.resolve(__dirname, blogOutputPath);
	const creators = ['willson369'];
	
	console.log('\n=== 🔍 开始同步 ===');
	console.log('目标仓库:', `${GH_USER}/${GH_PROJECT_NAME}`);
	console.log('完整 API URL:', `https://api.github.com/repos/${GH_USER}/${GH_PROJECT_NAME}/issues`);
	
	// 检查目标目录
	console.log('输出目录:', filePath);
	fs.ensureDirSync(filePath);
	fs.emptyDirSync(filePath);
	console.log('目录已清空');
	
	for (const name of creators) {
		console.log(`\n📝 正在查询 ${name} 的 issues...`);
		
		try {
			// 1. 先测试仓库基本信息
			console.log('1. 测试仓库访问...');
			const repoResponse = await api.get(`/repos/${GH_USER}/${GH_PROJECT_NAME}`);
			console.log(`   ✅ 仓库存在: ${repoResponse.data.full_name}`);
			console.log(`   📊 仓库信息: ${repoResponse.data.description || '无描述'}`);
			console.log(`   🔒 可见性: ${repoResponse.data.private ? '私有' : '公开'}`);
			console.log(`   ⭐ 星标数: ${repoResponse.data.stargazers_count}`);
			console.log(`   🍴 Fork 数: ${repoResponse.data.forks_count}`);
			
			// 2. 获取 issues
			console.log('\n2. 获取 issues...');
			console.log(`   请求: GET /repos/${GH_USER}/${GH_PROJECT_NAME}/issues`);
			console.log(`   参数: state=all, creator=${name}`);
			
			const issuesResponse = await api.get(`/repos/${GH_USER}/${GH_PROJECT_NAME}/issues`, {
				params: {
					state: 'all',
					per_page: 100,
					creator: name
				}
			});
			
			console.log(`   ✅ 请求成功！状态码: ${issuesResponse.status}`);
			console.log(`   📄 找到 ${issuesResponse.data.length} 个 issues`);
			
			if (issuesResponse.data.length === 0) {
				console.log('   ⚠️  没有找到 issues！尝试获取所有 issues...');
				
				// 尝试获取所有 issues
				const allIssuesResponse = await api.get(`/repos/${GH_USER}/${GH_PROJECT_NAME}/issues`, {
					params: {
						state: 'all',
						per_page: 100
					}
				});
				
				console.log(`   📊 所有 issues: ${allIssuesResponse.data.length} 个`);
				if (allIssuesResponse.data.length > 0) {
					console.log('   👥 创建者列表:');
					const creators = [...new Set(allIssuesResponse.data.map(item => item.user.login))];
					creators.forEach(creator => {
						const count = allIssuesResponse.data.filter(item => item.user.login === creator).length;
						console.log(`      - ${creator}: ${count} 个`);
					});
				}
				
				console.log('   💡 建议：请检查 issue 的创建者是否为 willson369');
				return;
			}
			
			// 3. 处理 issues
			console.log('\n3. 处理 issues...');
			let successCount = 0;
			
			for (const item of issuesResponse.data) {
				try {
					console.log(`   🔧 处理 issue #${item.number}: ${item.title}`);
					
					const fileName = `post-${item.number}`;
					const content = generateMdx(item, fileName);
					const fileFullPath = `${filePath}/${fileName}.mdx`;
					
					fs.writeFileSync(fileFullPath, content);
					console.log(`      ✅ 已生成: ${fileName}.mdx`);
					successCount++;
					
				} catch (error) {
					console.log(`      ❌ 处理失败: ${error.message}`);
				}
			}
			
			// 4. 总结
			console.log('\n=== 🎉 同步完成 ===');
			console.log(`成功生成: ${successCount}/${issuesResponse.data.length} 篇文章`);
			console.log(`文件位置: ${filePath}/`);
			console.log(`下次访问: https://你的博客域名/posts/`);
			
			// 列出生成的文件
			const files = fs.readdirSync(filePath);
			console.log(`生成的文件: ${files.length} 个`);
			files.forEach(file => {
				console.log(`   - ${file}`);
			});
			
		} catch (error) {
			console.error('\n❌ 同步失败！详细错误信息：');
			console.error('错误类型:', error.name);
			console.error('错误消息:', error.message);
			
			if (error.response) {
				console.error('HTTP 状态码:', error.response.status);
				console.error('错误信息:', error.response.data?.message);
				console.error('文档链接:', error.response.data?.documentation_url);
				console.error('请求 URL:', error.config?.url);
				console.error('请求方法:', error.config?.method);
				console.error('请求头:', JSON.stringify(error.config?.headers, null, 2));
				
				// 如果是认证问题
				if (error.response.status === 401 || error.response.status === 403) {
					console.error('\n🔐 认证问题可能原因：');
					console.error('1. Token 已过期或无效');
					console.error('2. Token 权限不足（需要 repo 权限）');
					console.error('3. 仓库是私有的，但 Token 没有访问权限');
				}
				
				// 如果是 404
				if (error.response.status === 404) {
					console.error('\n🔍 404 问题可能原因：');
					console.error('1. 仓库不存在: https://github.com/willson369/my-blog');
					console.error('2. 仓库名错误（大小写敏感）');
					console.error('3. 用户无权限访问该仓库');
				}
			} else if (error.request) {
				console.error('请求已发送但无响应');
				console.error('请求配置:', error.config);
			} else {
				console.error('请求配置错误:', error.config);
			}
			
			// 额外的调试信息
			console.error('\n🔧 调试信息：');
			console.error('当前时间:', new Date().toISOString());
			console.error('Node 版本:', process.version);
			console.error('当前目录:', __dirname);
		}
	}
}

module.exports = main;
