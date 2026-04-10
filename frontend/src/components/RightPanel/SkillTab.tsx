import { SKILL_CATALOG, SKILL_CATEGORIES } from '../../constants/agentRegistry';
import type { SkillInfo } from '../../constants/agentRegistry';
import styles from './SkillTab.module.css';

const grouped = SKILL_CATALOG.reduce<Record<string, SkillInfo[]>>((acc, skill) => {
  (acc[skill.category] ??= []).push(skill);
  return acc;
}, {});

const categoryOrder: Array<keyof typeof SKILL_CATEGORIES> = ['pipeline', 'query', 'system'];

function SkillCard({ skill }: { skill: SkillInfo }) {
  const cat = SKILL_CATEGORIES[skill.category];
  return (
    <div className={styles.card} title={skill.desc}>
      <span className={styles.cardIcon}>{skill.icon}</span>
      <span className={styles.cardName}>{skill.name}</span>
      <span
        className={styles.cardTag}
        style={{ color: cat.color, background: cat.bg }}
      >
        {cat.label}
      </span>
    </div>
  );
}

export function SkillTab() {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.title}>技能目录</span>
        <span className={styles.count}>{SKILL_CATALOG.length} skills</span>
      </div>

      {categoryOrder.map((catKey) => {
        const skills = grouped[catKey];
        if (!skills?.length) return null;
        const cat = SKILL_CATEGORIES[catKey];
        return (
          <div key={catKey} className={styles.group}>
            <div className={styles.groupHeader}>
              <span
                className={styles.groupDot}
                style={{ background: cat.color }}
              />
              <span className={styles.groupLabel}>{cat.label}</span>
              <span className={styles.groupCount}>{skills.length}</span>
            </div>
            <div className={styles.grid}>
              {skills.map((s) => (
                <SkillCard key={s.id} skill={s} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
