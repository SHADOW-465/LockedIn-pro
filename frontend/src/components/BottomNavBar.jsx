export default function BottomNavBar({ currentTab, setCurrentTab }) {
  const items = [
    { id: 'home',      icon: 'grid_view',    label: 'Home'      },
    { id: 'mandates',  icon: 'task_alt',     label: 'Mandates'  },
    { id: 'chronicle', icon: 'auto_stories', label: 'Chronicle' },
    { id: 'chat',      icon: 'psychology',   label: 'Master'    },
    { id: 'chamber',   icon: 'lock_person',  label: 'Chamber'   },
  ];

  return (
    <nav className="flex-shrink-0 bg-neutral-950/95 backdrop-blur-3xl w-full border-t border-neutral-800/40 z-50 pb-safe">
      <div className="flex items-stretch w-full h-16">
        {items.map(({ id, icon, label }) => {
          const isActive = currentTab === id;
          const isChat = id === 'chat';
          return (
            <button
              key={id}
              onClick={() => setCurrentTab(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 relative
                ${isActive
                  ? isChat ? 'text-primary' : 'text-neutral-100'
                  : 'text-neutral-600 hover:text-neutral-400'
                }`}
            >
              {/* Active indicator line */}
              {isActive && (
                <span className={`absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full ${isChat ? 'bg-primary' : 'bg-neutral-100'}`} />
              )}
              {/* Pulse dot on chat */}
              {isChat && !isActive && (
                <span className="absolute top-1.5 right-1/4 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
              <span className="material-symbols-outlined text-[21px] leading-none">{icon}</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
