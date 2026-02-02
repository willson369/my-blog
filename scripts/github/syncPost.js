// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
/* eslint-disable */
const GitHub = require('github-api');
const fs = require('fs-extra');
const path = require('path');
// console.log(process.env, ' process.env');
const { GH_TOKEN, GH_USER, GH_PROJECT_NAME } = process.env;

// 清理 Token，确保没有非法字符
const cleanToken = (GH_TOKEN || '').toString()
  .replace(/\r/g, '')
  .replace(/\n/g, '')
  .trim();

console.log('=== 调试信息 ===');
console.log('GH_USER:', GH_USER);
console.log('GH_PROJECT_NAME:', GH_PROJECT_NAME);
console.log('Token长度:', cleanToken.length);
console.log('Token前10位:', cleanToken.substring(0, 10) + '...');
console.log('请求URL:', `https://api.github.com/repos/${GH_USER}/${GH_PROJECT_NAME}/issues`);

const gh = new GitHub({
  token: cleanToken
});

const blogOutputPath = '../../data/blog';

if (!GH_USER || !GH_PROJECT_NAME) {
	console.error('请设置GH_USER和GH_PROJECT_NAME');
	process.exit(-1);
}

// 如果是 img 标签，并且没有闭合，那么就拼接闭合字符
function closeImgTag(htmlString) {
	// 使用正则表达式匹配未闭合的 <img> 标签
	const imgTagRegex = /<img([^>]*)(?<!\/)>/g;
	// 将未闭合的 <img> 标签替换为自闭合的 <img /> 标签
	return htmlString.replace(imgTagRegex, '<img$1 />');
}

// get blog list
const issueInstance = gh.getIssues(GH_USER, GH_PROJECT_NAME);
function generateMdx(issue, fileName) {
	console.log('处理issue:', issue.number, issue.title);
	const { title, labels, created_at, body, html_url, user } = issue;
	return `---
title: ${title.trim()}
date: ${created_at}
slug: ${fileName}
author: ${user?.login}：${user?.html_url}
tags: ${JSON.stringify(labels.map((item) => item.name))}
---

${closeImgTag(body.replace(/<br \/>/g, '\n'))}

---
此文自动发布于：<a href="${html_url}" target="_blank">github issues</a>
`;
}

function main() {
	const filePath = path.resolve(__dirname, blogOutputPath);
	const creators = ['willson369'];
	
	console.log('=== 开始同步 ===');
	console.log('仓库:', GH_USER + '/' + GH_PROJECT_NAME);
	console.log('查询的创建者:', creators);
	
	fs.ensureDirSync(filePath);
	fs.emptyDirSync(filePath);
	
	creators.forEach((name) => {
		console.log(`正在查询 ${name} 的 issues...`);
		
		// 修改这里：去掉 creator 参数，先获取所有 issues
		issueInstance.listIssues({}).then(({ data }) => {
			// 过滤出指定创建者的 issues
			const filteredData = data.filter(item => item.user.login === name);
			console.log(`找到 ${data.length} 个 issues，其中 ${filteredData.length} 个是 ${name} 创建的`);
			
			if (filteredData.length === 0) {
				console.log('警告：没有找到指定创建者的 issues！');
				console.log('所有 issues 的创建者:', data.map(item => item.user.login));
				return;
			}
			
			let successCount = 0;
			for (const item of filteredData) {
				try {
					const fileName = `post-${item.number}`;
					const content = generateMdx(item, fileName);
					fs.writeFileSync(`${filePath}/${fileName}.mdx`, content);
					console.log(`✅ 成功生成: ${filePath}/${fileName}.mdx`);
					successCount++;
				} catch (error) {
					console.log(`❌ 处理 issue #${item.number} 失败:`, error.message);
				}
			}
			
			if (successCount === filteredData.length) {
				console.log(`✅ 文章全部同步成功！共 ${successCount} 篇`);
			} else {
				console.log(`⚠️ 文章同步完成，成功 ${successCount}/${filteredData.length} 篇`);
			}
			
		}).catch(error => {
			console.error('❌ API 调用失败:');
			console.error('错误信息:', error.message);
			console.error('错误详情:', error.response?.data || error);
			console.error('请检查:');
			console.error('1. Token 是否有 repo 权限？');
			console.error('2. 仓库 https://github.com/' + GH_USER + '/' + GH_PROJECT_NAME + ' 是否能访问？');
			console.error('3. Token 是否已过期？');
		});
	});
}

module.exports = main;
