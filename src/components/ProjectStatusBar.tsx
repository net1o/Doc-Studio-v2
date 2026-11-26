import { Check, Circle, Clock } from 'lucide-react';

interface MilestoneStep {
  label: string;
  state: 'done' | 'active' | 'pending';
}

const STEPS: MilestoneStep[] = [
  { label: 'Plan', state: 'done' },
  { label: 'Local app', state: 'done' },
  { label: 'Database', state: 'done' },
  { label: 'Vercel', state: 'active' },
  { label: 'Production', state: 'pending' },
];

export function ProjectStatusBar() {
  return (
    <section
      aria-label="Rollout progress"
      className="bg-white border border-[#e6e3ee] rounded-[10px] px-4 py-3 shadow-[0_1px_3px_rgba(31,27,46,0.03)]"
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="font-editorial text-sm font-bold text-[#1f1b2e]">
              Rollout Status
            </h2>
            <span className="text-xs font-semibold text-[#7463e8] tabular-nums">
              80% complete
            </span>
          </div>
          <p className="text-xs text-[#655f78] leading-relaxed">
            Completed: Plan, Local app, and Database baseline. Active: Vercel preview validation. Pending: Production release awaits authenticated Preview QA and approval.
          </p>
        </div>

        <div className="flex flex-col gap-2 lg:min-w-[440px]">
          <div
            role="progressbar"
            aria-label="Document Studio rollout progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={80}
            className="h-2 w-full bg-[#eeebf6] rounded-[8px] overflow-hidden"
          >
            <div
              className="h-full bg-[#7463e8] rounded-[8px] transition-all duration-200"
              style={{ width: '80%' }}
            />
          </div>

          <ol className="grid grid-cols-5 gap-1.5 text-[11.5px]">
            {STEPS.map((step) => {
              const isDone = step.state === 'done';
              const isActive = step.state === 'active';
              return (
                <li
                  key={step.label}
                  className={`flex items-center gap-1 whitespace-nowrap truncate ${
                    isDone
                      ? 'text-[#1f1b2e] font-medium'
                      : isActive
                      ? 'text-[#7463e8] font-semibold'
                      : 'text-[#847d99]'
                  }`}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5 text-[#7463e8] shrink-0" aria-hidden="true" />
                  ) : isActive ? (
                    <Clock className="w-3.5 h-3.5 text-[#7463e8] shrink-0" aria-hidden="true" />
                  ) : (
                    <Circle className="w-3 h-3 text-[#b8b1cb] shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">{step.label}</span>
                  <span className="sr-only">
                    {isDone ? 'done' : isActive ? 'active' : 'pending'}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
