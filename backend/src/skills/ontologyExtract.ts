import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { callLLM, extractJSON } from '../services/LLMService.js';

const SYSTEM_PROMPT = `你是一个知识工程专家。根据提供的文档原始内容，提取结构化的本体知识，按四层结构组织：本体类、实体、关系、属性。

## 提取规则

### 本体类（classes）
- 对领域中的核心概念进行分类归纳
- 每个类代表一个抽象概念类别

### 实体（entities）
- 文档中出现的具体对象、事物、名词
- 每个实体必须归属到一个本体类（class 字段）

### 关系（relations）
- 实体之间的语义关联
- 必须明确指定 source（起始实体名）和 target（目标实体名）
- source 和 target 必须是 entities 中已存在的实体名称
- 关系名称应简洁（2-4个字），如"包含"、"属于"、"连接"、"记录于"

### 属性（attributes）
- 实体的特征、参数、指标，**包含具体数值**
- 必须指定归属实体（entity 字段），该实体必须在 entities 中存在
- value 字段必须填入文档中的**原始数值**（含单位）

## ⚠️ 表格/时序数据提取规则（非常重要）

如果文档包含表格、统计报表、运行记录等逐行数据：
1. **每行数据创建一个独立实体**，命名格式为"时间点+数据类型"，如"08时运行数据"、"2024年1月销售数据"
2. **每个单元格数值作为该行实体的属性**，属性名为列标题，value 为具体数值（含单位）
3. **不要只提取汇总值而丢弃明细数据**——明细行的每个数值都是重要知识
4. **同时提取汇总值**（如日总量、平均值）作为独立实体的属性

示例：若文档有一行 "08:00  热负荷34.8MW  耗气量829Nm³"，应提取：
- 实体：{ "name": "08时运行数据", "class": "逐时运行数据", "desc": "08:00时刻的运行参数" }
- 属性：{ "name": "热负荷", "entity": "08时运行数据", "value": "34.8MW", "desc": "08时热负荷" }
- 属性：{ "name": "耗气量", "entity": "08时运行数据", "value": "829Nm³", "desc": "08时耗气量" }

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
- entities 的 class 必须精确匹配 classes 中的 name
- **不要省略任何数据行，所有表格数据都必须完整提取**`;

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
  const rawText = (docData?.rawText as string) ?? '';
  const summary = (docData?.summary as string) ?? '';

  const docContent = rawText || summary || '无文档内容';
  const userPrompt = `以下是文档原始内容，请提取完整的本体知识（本体类、实体、关系、属性）。特别注意：表格中的每一行数据都要逐行提取，不要只提取汇总值。\n\n${docContent}`;

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
