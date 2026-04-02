import type { ExecutionContext, SkillResult } from '../agents/types.js';

/**
 * Ontology extraction skill.
 * In production: calls LLM to extract entities, relations, rules, and attributes from document text.
 * Currently: returns mock ontology data.
 */
export async function ontologyExtractSkill(_ctx: ExecutionContext): Promise<SkillResult> {
  await sleep(randomBetween(4000, 8000));

  return {
    skillName: '本体提取',
    status: 'success',
    data: {
      entities: [
        { name: '信息安全策略', type: 'entity', desc: '组织信息安全总体方针' },
        { name: '安全等级', type: 'attr', desc: '机密/秘密/内部/公开' },
        { name: '数据分类', type: 'entity', desc: '按敏感程度划分数据类别' },
        { name: '访问控制', type: 'entity', desc: '用户权限管理机制' },
        { name: '网络安全', type: 'entity', desc: '网络边界防护与入侵检测' },
        { name: '物理安全', type: 'entity', desc: '机房与设备物理防护' },
        { name: '安全事件', type: 'entity', desc: '安全事件记录与响应' },
        { name: '审计日志', type: 'entity', desc: '操作行为审计追溯' },
        { name: '合规审计', type: 'entity', desc: '定期合规检查机制' },
        { name: '管辖', type: 'relation', desc: '安全策略 → 数据分类' },
        { name: '约束', type: 'relation', desc: '访问控制 → 安全等级' },
        { name: '覆盖', type: 'relation', desc: '安全策略 → 网络安全' },
      ],
      entityCount: 18,
      relationCount: 12,
      ruleCount: 9,
      attrCount: 25,
    },
    tokenUsed: 3891,
    duration: 8.5,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
