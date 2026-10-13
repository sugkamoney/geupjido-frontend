import type { ComponentPropsWithRef } from 'react';

export type Grade = 1 | 2 | 3 | 4 | 5;
export type GradeStageName = 'Collecting' | 'Provisional' | 'Confirmed';
const stages: { value: GradeStageName; label: string; description: string }[] =
  [
    {
      value: 'Collecting',
      label: '모으는 중',
      description: '시세순 급지표를 기준으로 표시된 급지입니다.',
    },
    {
      value: 'Provisional',
      label: '잠정',
      description: '시세순 급지표와 사용자 비교 결과를 함께 반영했습니다.',
    },
    {
      value: 'Confirmed',
      label: '민심급지',
      description:
        '비교 결과가 충분히 쌓여 사용자 선택을 기준으로 정해졌습니다.',
    },
  ];
export function GradeChip({
  grade,
  value,
  className = '',
  ...props
}: ComponentPropsWithRef<'span'> & { grade: Grade; value: string }) {
  return (
    <span
      {...props}
      className={`ui-grade ui-grade-chip ${className}`}
      data-grade={grade}
      aria-label={`민심급지 ${value}`}
    >
      {value}
    </span>
  );
}
export function GradeCard({
  grade,
  value,
  rankText,
  className = '',
  ...props
}: ComponentPropsWithRef<'div'> & {
  grade: Grade;
  value: string;
  rankText: string;
}) {
  return (
    <div
      {...props}
      className={`ui-grade ui-grade-card ${className}`}
      data-grade={grade}
    >
      <img
        className="ui-grade-house"
        src="/assets/images/house-screen.png"
        alt=""
      />
      <span className="ui-grade-title">민심급지</span>
      <span className="ui-grade-value">{value}</span>
      <span className="ui-grade-rank">{rankText}</span>
    </div>
  );
}
export function GradeStage({
  stage,
  className = '',
  ...props
}: ComponentPropsWithRef<'div'> & { stage: GradeStageName }) {
  const current = stages.findIndex((item) => item.value === stage);
  return (
    <div {...props} className={`ui-grade-stage ${className}`}>
      <ol>
        {stages.map((item, index) => (
          <li
            key={item.value}
            data-state={
              index < current
                ? 'past'
                : index === current
                  ? 'current'
                  : 'future'
            }
          >
            <span className="ui-stage-bar" aria-hidden="true" />
            <span aria-current={index === current ? 'step' : undefined}>
              {item.label}
            </span>
          </li>
        ))}
      </ol>
      <p>{stages.find((item) => item.value === stage)?.description}</p>
    </div>
  );
}
