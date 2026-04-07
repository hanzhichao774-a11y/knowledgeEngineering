import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { callLLM, extractJSON } from '../services/LLMService.js';

const SYSTEM_PROMPT = `你是一个知识工程专家。根据提供的文档解析结果，提取结构化的本体知识，按四层结构组织：本体类、实体、关系、属性。

## 提取规则

### 本体类（classes）
- 对领域中的核心概念进行分类归纳
- 每个类代表一个抽象概念类别，如"设备"、"操作流程"、"安全标准"
- 数量控制在 5-10 个

### 实体（entities）
- 文档中出现的具体对象、事物、名词
- 每个实体必须归属到一个本体类（class 字段）
- 数量控制在 15-30 个

### 关系（relations）
- 实体之间的语义关联
- 必须明确指定 source（起始实体名）和 target（目标实体名）
- source 和 target 必须是 entities 中已存在的实体名称
- 关系名称应简洁（2-4个字），如"包含"、"属于"、"连接"、"执行"、"依据"
- 数量控制在 10-20 条

### 属性（attributes）
- 实体的特征、参数、指标
- 必须指定归属实体（entity 字段），该实体必须在 entities 中存在
- 尽量提取具体值（value 字段）
- 数量控制在 10-25 个

## 输出格式

返回严格的 JSON：
\`\`\`json
{
  "classes": [
    { "name": "类名", "desc": "类的描述" }
  ],
  "entities": [
    { "name": "实体名", "class": "所属类名", "desc": "简短描述" }
  ],
  "relations": [
    { "name": "关系名", "source": "起始实体名", "target": "目标实体名", "desc": "关系描述" }
  ],
  "attributes": [
    { "name": "属性名", "entity": "所属实体名", "value": "属性值", "desc": "属性描述" }
  ]
}
\`\`\`

注意：
- relations 的 source 和 target 必须精确匹配 entities 中的 name
- attributes 的 entity 必须精确匹配 entities 中的 name
- entities 的 class 必须精确匹配 classes 中的 name`;

export interface OntologyClass {
  name: string;
  desc: string;
}

export interface OntologyEntity {
  name: string;
  class: string;
  desc: string;
}

export interface OntologyRelation {
  name: string;
  source: string;
  target: string;
  desc: string;
}

export interface OntologyAttribute {
  name: string;
  entity: string;
  value: string;
  desc: string;
}

export interface OntologyData {
  classes: OntologyClass[];
  entities: OntologyEntity[];
  relations: OntologyRelation[];
  attributes: OntologyAttribute[];
}

export async function ontologyExtractSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const docResult = ctx.previousResults.find((r) => r.skillName === '多模态文档解析');
  const docData = docResult?.data as Record<string, unknown> | undefined;
  const summary = (docData?.summary as string) ?? '无文档摘要';

  const userPrompt = `文档摘要：${summary}\n\n请从该文档中提取完整的本体知识（本体类、实体、关系、属性）。`;

  try {
    const { text, usage } = await callLLM(SYSTEM_PROMPT, userPrompt);
    const data = extractJSON<OntologyData>(text);

    const entityNames = new Set(data.entities?.map((e) => e.name) ?? []);
    const validRelations = (data.relations ?? []).filter(
      (r) => entityNames.has(r.source) && entityNames.has(r.target),
    );
    const validAttributes = (data.attributes ?? []).filter(
      (a) => entityNames.has(a.entity),
    );

    const result: OntologyData & Record<string, unknown> = {
      classes: data.classes ?? [],
      entities: data.entities ?? [],
      relations: validRelations,
      attributes: validAttributes,
      classCount: data.classes?.length ?? 0,
      entityCount: data.entities?.length ?? 0,
      relationCount: validRelations.length,
      attrCount: validAttributes.length,
    };

    console.log(`[Skill:ontologyExtract] Extracted: ${result.classCount} classes, ${result.entityCount} entities, ${result.relationCount} relations, ${result.attrCount} attributes`);

    const duration = (Date.now() - startTime) / 1000;
    return {
      skillName: '本体提取',
      status: 'success',
      data: result,
      tokenUsed: usage?.inputTokens ?? 0,
      duration,
    };
  } catch (err) {
    console.error('[Skill:ontologyExtract] Failed:', (err as Error).message);
    const duration = (Date.now() - startTime) / 1000;
    return {
      skillName: '本体提取',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration,
    };
  }
}
