import React from 'react';

export function SummaryCard({ title, value, unit, tags }) {
  return (
    <div className="bg-surface-container-low p-md rounded-[24px] border border-outline-variant/30 md:col-span-2 flex flex-col justify-between min-h-[180px] shadow-sm">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <span className="font-label-caps text-label-caps text-secondary uppercase">
            {title}
          </span>
          <div className="font-display-lg text-display-lg text-primary">
            {value} {unit}
          </div>
        </div>
        <div className="bg-surface-container-highest p-3 rounded-full ring-1 ring-outline-variant">
          <span
            className="material-symbols-outlined text-secondary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            bolt
          </span>
        </div>
      </div>
      <div className="flex gap-2 items-center mt-4 overflow-x-auto pb-2 no-scrollbar">
        {tags?.map((tag) => (
          <span
            key={tag}
            className="bg-surface-container-high px-4 py-1.5 rounded-full text-[12px] font-bold text-on-surface border border-outline-variant/50"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SessionCard({ time, duration, type, title, description, verdict, verdictType }) {
  const isPro = type === 'PRO';
  const isEmergency = type === 'EMERGENCY';

  const iconName = isEmergency ? 'warning' : isPro ? 'schedule' : 'history';
  const containerClass = isEmergency
    ? 'bg-error-container/10 border-error-container/20'
    : isPro
    ? 'bg-secondary-container/20 border-secondary-container/30'
    : 'bg-tertiary-container/10 border-tertiary-container/20';

  const iconClass = isEmergency ? 'text-error' : isPro ? 'text-secondary' : 'text-tertiary-fixed-dim';

  const badgeClass = isEmergency
    ? 'text-error'
    : isPro
    ? 'text-secondary'
    : 'text-on-tertiary-container';

  return (
    <div className="bg-surface-container p-md rounded-[24px] border border-outline-variant/20 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center border ${containerClass}`}
          >
            <span className={`material-symbols-outlined text-sm ${iconClass}`}>
              {iconName}
            </span>
          </div>
          <div>
            <div className="font-title-sm text-title-sm text-primary">{title}</div>
            <div className="font-label-caps text-[10px] text-on-surface-variant">
              {time} • {duration}
            </div>
          </div>
        </div>
        {!isEmergency && (
          <div className={`bg-surface-container-highest px-3 py-1 rounded-full text-[10px] font-bold ${badgeClass}`}>
            {type}
          </div>
        )}
      </div>

      {/* Pillbox Card Content */}
      <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/10 space-y-4">
        <div className="space-y-1">
          <span className="font-label-caps text-[10px] text-outline uppercase">
            Task
          </span>
          <p className="font-body-rt text-sm text-on-surface">{description}</p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
          <div className="flex flex-col">
            <span className="font-label-caps text-[10px] text-outline uppercase">
              Verdict
            </span>
            <span
              className={`font-semibold text-sm ${
                verdictType === 'error' ? 'text-error' : 'text-primary'
              }`}
            >
              {verdict}
            </span>
          </div>
          {verdictType !== 'error' && (
            <div className="flex gap-1">
               {/* Simplified dots for now */}
              <div className={`w-2 h-2 rounded-full ${isPro ? 'bg-secondary' : 'bg-on-tertiary-container'}`}></div>
              <div className={`w-2 h-2 rounded-full ${isPro ? 'bg-secondary' : 'bg-on-tertiary-container'}`}></div>
              <div className={`w-2 h-2 rounded-full ${isPro ? 'bg-secondary' : 'bg-surface-container-highest'}`}></div>
              <div className="w-2 h-2 rounded-full bg-surface-container-highest"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StatCard({ title, value, type, metric, trend }) {
  if (type === 'progress') {
    return (
      <div className="bg-surface-container-low p-md rounded-[24px] border border-outline-variant/30 flex flex-col justify-center items-center text-center gap-2">
        <span className="font-label-caps text-label-caps text-outline uppercase text-[10px]">
          {title}
        </span>
        <div className="font-display-lg text-4xl text-secondary font-bold">
          {value}
        </div>
        <div className="w-full bg-surface-container-highest h-1 rounded-full mt-2">
          <div
            className="bg-secondary h-full rounded-full"
            style={{ width: metric }}
          ></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low p-6 rounded-[32px] border border-outline-variant/20 flex flex-col justify-between items-start min-h-[140px] shadow-sm">
      <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
        {title}
      </span>
      <div>
        <div className="font-display text-4xl text-on-surface font-bold">
          {value}
        </div>
        {trend && (
          <div className="text-[10px] uppercase font-bold text-secondary mt-1">
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskCard({ id, title, category, importance, completed, onToggle }) {
  return (
    <div 
      onClick={() => onToggle(id)}
      className={`col-span-12 cursor-pointer group relative overflow-hidden transition-all duration-500 rounded-[32px] border p-6 flex items-center justify-between
        ${completed 
          ? 'bg-primary/5 border-primary/20 opacity-60' 
          : 'bg-surface-container border-outline/10 hover:border-outline/30 shadow-sm'
        }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-500
          ${completed ? 'bg-primary border-primary' : 'border-outline/20 group-hover:border-on-surface/30'}`}
        >
          {completed && (
            <span className="material-symbols-outlined text-surface text-lg font-bold">check</span>
          )}
        </div>
        <div>
          <span className={`block font-display font-semibold text-lg transition-all ${completed ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
            {title}
          </span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60">
            {category} • {importance}
          </span>
        </div>
      </div>
      
      {!completed && importance === 'High' && (
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
          <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse delay-75" />
        </div>
      )}
    </div>
  );
}

export function VaultFileCard({ name, type, status, date, onDelete }) {
  return (
    <div className="bg-surface-container border border-outline/10 rounded-[32px] p-5 flex items-center justify-between group hover:border-outline/30 transition-all">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-surface-container-low border border-outline/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-on-surface-variant">
            {type === 'Audio' ? 'audiotrack' : 'description'}
          </span>
        </div>
        <div>
          <span className="block font-semibold text-sm">{name}</span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60">{type} • {date}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${status === 'Synced' ? 'border-primary/30 text-primary bg-primary/5' : 'border-outline/20 text-on-surface-variant animate-pulse'}`}>
          {status}
        </span>
        <button 
          onClick={onDelete}
          className="text-on-surface-variant/40 hover:text-error transition-colors p-1"
        >
          <span className="material-symbols-outlined text-xl">delete</span>
        </button>
      </div>
    </div>
  );
}
