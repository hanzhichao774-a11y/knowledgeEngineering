import type { ExecutionContext, SkillResult } from '../agents/types.js';

/**
 * Document parsing skill.
 * In production: calls LLM with multi-modal capabilities to parse PDF/Word.
 * Currently: returns mock structured result.
 */
export async function documentParseSkill(_ctx: ExecutionContext): Promise<SkillResult> {
  await sleep(randomBetween(2000, 4000));

  return {
    skillName: '多模态文档解析',
    status: 'success',
    data: {
      pageCount: 38,
      chapters: 7,
      paragraphs: 42,
      tables: 15,
      summary: '本文档为企业信息安全管理制度，共 7 章 38 页，涵盖：信息安全策略、数据分类分级、访问控制、网络安全、物理安全、安全事件管理、合规审计。',
    },
    tokenUsed: 1247,
    duration: 3.2,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
