
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ProjectGroup, Meeting, NoteRow } from './types';
import { INITIAL_DATA } from './constants';
import MeetingView from './components/MeetingView';
import { 
  Plus, 
  Layout, 
  ChevronRight, 
  ChevronDown,
  Edit3, 
  Trash2, 
  FileText, 
  Folder, 
  Menu, 
  X,
  Search,
  Settings,
  MoreVertical,
  Clock,
  Moon,
  Sun,
  History
} from 'lucide-react';

const App: React.FC = () => {
  const [projects, setProjects] = useState<ProjectGroup[]>(() => {
    const saved = localStorage.getItem('archi_notes_v1');
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });
  
  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0]?.id || '');
  const [activeMeetingId, setActiveMeetingId] = useState<string>(projects[0]?.meetings[0]?.id || '');
  // Track which project groups are 'open' (expanded) in the sidebar
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([projects[0]?.id || '']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renamingMeetingId, setRenamingMeetingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [theme, setTheme] = useState<'day' | 'night'>(() => {
    const savedTheme = localStorage.getItem('archi_theme');
    return (savedTheme as 'day' | 'night') || 'night';
  });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('archi_theme', theme);
  }, [theme]);

  // Auto-save to LocalStorage
  useEffect(() => {
    localStorage.setItem('archi_notes_v1', JSON.stringify(projects));
  }, [projects]);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const activeMeeting = activeProject?.meetings.find(m => m.id === activeMeetingId);

  // Get recently edited meetings across all projects
  const recentMeetings = useMemo(() => {
    const allMeetings = projects.flatMap(p => 
      p.meetings.map(m => ({ ...m, projectId: p.id }))
    );
    return allMeetings
      .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
      .slice(0, 4);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return projects;

    const term = searchTerm.toLowerCase();
    return projects.map(project => {
      const projectMatches = project.name.toLowerCase().includes(term);
      const matchingMeetings = project.meetings.filter(m => 
        m.name.toLowerCase().includes(term)
      );

      if (projectMatches) return project;
      if (matchingMeetings.length > 0) return { ...project, meetings: matchingMeetings };
      return null;
    }).filter((p): p is ProjectGroup => p !== null);
  }, [projects, searchTerm]);

  const toggleProjectExpansion = (id: string) => {
    setExpandedProjectIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const createGroup = () => {
    const newGroup: ProjectGroup = {
      id: crypto.randomUUID(),
      name: 'New Project Group',
      meetings: []
    };
    setProjects(prev => [...prev, newGroup]);
    setActiveProjectId(newGroup.id);
    setExpandedProjectIds(prev => [...prev, newGroup.id]);
    setSearchTerm('');
  };

  const createMeeting = (projectId: string) => {
    const newMeeting: Meeting = {
      id: crypto.randomUUID(),
      name: `Meeting - ${new Date().toLocaleDateString()}`,
      dateCreated: new Date().toISOString(),
      attendees: [],
      rows: []
    };
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, meetings: [...p.meetings, newMeeting] } : p
    ));
    setActiveMeetingId(newMeeting.id);
    setActiveProjectId(projectId);
    if (!expandedProjectIds.includes(projectId)) {
      setExpandedProjectIds(prev => [...prev, projectId]);
    }
    setSearchTerm('');
  };

  const updateMeeting = (updatedMeeting: Meeting) => {
    setProjects(prev => prev.map(p => ({
      ...p,
      meetings: p.meetings.map(m => m.id === updatedMeeting.id ? updatedMeeting : m)
    })));
  };

  const deleteGroup = (id: string) => {
    if (confirm('Delete this project and all its meetings?')) {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProjectId === id) {
        setActiveProjectId('');
        setActiveMeetingId('');
      }
    }
  };

  const deleteMeeting = (projectId: string, meetingId: string) => {
      if (confirm('Delete this meeting note?')) {
          setProjects(prev => prev.map(p => 
            p.id === projectId ? { ...p, meetings: p.meetings.filter(m => m.id !== meetingId) } : p
          ));
          if (activeMeetingId === meetingId) {
            setActiveMeetingId('');
          }
      }
  };

  const closeActiveMeeting = () => {
    setActiveMeetingId('');
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'night' ? 'day' : 'night');
  };

  return (
    <div className="flex h-screen w-full bg-appBg overflow-hidden text-textMain">
      {/* Sidebar: Project Groups (The Group Navigator) */}
      <aside className={`bg-sidebarBg border-r border-borderMain transition-all duration-300 flex flex-col z-30 ${sidebarOpen ? 'w-72' : 'w-0 overflow-hidden border-none'}`}>
        <div className="p-6 border-b border-borderMain flex items-center justify-between">
          <div className="flex items-center space-x-2 text-textMain overflow-hidden">
            <Layout className="shrink-0 text-emeraldArch" size={24} />
            <h1 className="font-bold text-xl tracking-tight whitespace-nowrap">ArchiNotes</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-textMuted hover:text-emeraldArch transition-colors p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pt-4 pb-2">
          <div className="relative group">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted group-focus-within:text-emeraldArch transition-colors" />
            <input 
              type="text"
              placeholder="Search project logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-appBg text-textMain text-sm pl-10 pr-4 py-2 rounded-lg border border-borderMain focus:outline-none focus:border-emeraldArch transition-all placeholder:text-textMuted/50"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textMain">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-textMuted">Project Groups</span>
              <button 
                onClick={createGroup}
                className="p-1 hover:bg-appBg rounded-md text-textMuted hover:text-emeraldArch transition-colors"
                title="Create New Group"
              >
                <Plus size={16} />
              </button>
            </div>
            
            <div className="space-y-1">
              {filteredProjects.length === 0 && (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-textMuted italic">No matches found</p>
                </div>
              )}
              {filteredProjects.map(project => (
                <div key={project.id} className="space-y-1">
                  <div 
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${activeProjectId === project.id ? 'bg-appBg/50 border-l-2 border-emeraldArch' : 'hover:bg-appBg'}`}
                    onClick={() => {
                        setActiveProjectId(project.id);
                        toggleProjectExpansion(project.id);
                    }}
                    onDoubleClick={() => setRenamingGroupId(project.id)}
                  >
                    <div className="flex items-center space-x-3 overflow-hidden flex-1">
                      {expandedProjectIds.includes(project.id) ? (
                        <ChevronDown size={14} className="text-textMuted shrink-0" />
                      ) : (
                        <ChevronRight size={14} className="text-textMuted shrink-0" />
                      )}
                      <Folder size={18} className={activeProjectId === project.id ? 'text-emeraldArch' : 'text-textMuted'} />
                      {renamingGroupId === project.id ? (
                        <input 
                          autoFocus
                          value={project.name}
                          onChange={(e) => setProjects(prev => prev.map(p => p.id === project.id ? { ...p, name: e.target.value } : p))}
                          onBlur={() => setRenamingGroupId(null)}
                          onKeyDown={(e) => e.key === 'Enter' && setRenamingGroupId(null)}
                          className="bg-cardBg text-textMain px-1 border-b border-emeraldArch outline-none w-full"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className={`truncate text-sm font-semibold ${activeProjectId === project.id ? 'text-textMain' : 'text-textMuted'}`}>
                            {project.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <button onClick={(e) => { e.stopPropagation(); setRenamingGroupId(project.id); }} className="hover:text-emeraldArch p-1"><Edit3 size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteGroup(project.id); }} className="hover:text-red-500 p-1"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  
                  {expandedProjectIds.includes(project.id) && (
                    <div className="ml-6 border-l border-borderMain pl-4 space-y-1 animate-in slide-in-from-top-1 duration-200">
                      {project.meetings.map(meeting => (
                        <div 
                          key={meeting.id}
                          className={`group flex items-center justify-between py-1.5 px-3 rounded-md cursor-pointer text-xs transition-colors ${activeMeetingId === meeting.id ? 'bg-emeraldArch/10 text-emeraldArch font-bold' : 'text-textMuted hover:text-textMain hover:bg-appBg'}`}
                          onClick={() => {
                              setActiveMeetingId(meeting.id);
                              setActiveProjectId(project.id);
                          }}
                          onDoubleClick={() => setRenamingMeetingId(meeting.id)}
                        >
                          <div className="flex-1 overflow-hidden">
                            {renamingMeetingId === meeting.id ? (
                                <input 
                                  autoFocus
                                  value={meeting.name}
                                  onChange={(e) => updateMeeting({ ...meeting, name: e.target.value })}
                                  onBlur={() => setRenamingMeetingId(null)}
                                  onKeyDown={(e) => e.key === 'Enter' && setRenamingMeetingId(null)}
                                  className="bg-cardBg text-textMain px-1 border-b border-emeraldArch outline-none w-full"
                                  onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span className="truncate">{meeting.name}</span>
                            )}
                          </div>
                          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 shrink-0 ml-2">
                              <button onClick={(e) => { e.stopPropagation(); setRenamingMeetingId(meeting.id); }}><Edit3 size={12} /></button>
                              <button onClick={(e) => { e.stopPropagation(); deleteMeeting(project.id, meeting.id); }}><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                      <button 
                        onClick={() => createMeeting(project.id)}
                        className="flex items-center space-x-2 py-1.5 px-3 rounded-md text-[10px] font-bold uppercase tracking-tighter text-textMuted hover:text-emeraldArch transition-colors w-full text-left"
                      >
                        <Plus size={12} />
                        <span>Add Tab Note</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer with Theme Toggle - Fixed Bottom Left */}
        <div className="p-4 border-t border-borderMain flex items-center justify-between bg-sidebarBg">
          <div className="text-[9px] font-mono tracking-tighter opacity-40 uppercase">
            System: <span className="text-emeraldArch">Ready</span>
          </div>
          <button 
            onClick={toggleTheme}
            className="p-2.5 bg-appBg border border-borderMain rounded-xl text-textMuted hover:text-emeraldArch hover:border-emeraldArch/50 transition-all shadow-sm flex items-center justify-center"
            title={theme === 'night' ? "Day Mode" : "Night Mode"}
          >
            {theme === 'night' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-appBg relative transition-colors duration-300">
        {!sidebarOpen && (
            <div className="absolute top-6 left-6 z-20 flex flex-col space-y-4">
              <button 
                  onClick={() => setSidebarOpen(true)}
                  className="p-2.5 bg-sidebarBg text-emeraldArch border border-borderMain rounded-xl hover:bg-appBg transition-colors shadow-2xl"
                  title="Open Navigator"
              >
                  <Menu size={20} />
              </button>
              <button 
                onClick={toggleTheme}
                className="p-2.5 bg-sidebarBg text-textMain border border-borderMain rounded-xl hover:text-emeraldArch transition-colors shadow-2xl flex items-center justify-center"
              >
                {theme === 'night' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
        )}

        {activeMeeting ? (
          <MeetingView 
            meeting={activeMeeting} 
            onUpdate={updateMeeting} 
            onClose={closeActiveMeeting}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 text-center bg-appBg overflow-y-auto">
            <div className="w-24 h-24 bg-sidebarBg border border-emeraldArch/20 rounded-3xl flex items-center justify-center text-emeraldArch mb-6 rotate-3 shadow-2xl">
                <FileText size={48} />
            </div>
            <h2 className="text-4xl font-black text-textMain mb-2 tracking-tight">Project Dashboard</h2>
            <p className="text-textMuted max-w-md mb-10 text-sm leading-relaxed">
              Open a meeting tab from the navigator to continue your design log or start a new architectural session.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg mb-12">
                <button 
                    onClick={createGroup}
                    className="flex flex-col items-center justify-center space-y-3 p-6 bg-sidebarBg text-textMain border border-borderMain rounded-2xl hover:border-emeraldArch/50 hover:bg-cardBg transition-all group"
                >
                    <div className="p-3 bg-appBg rounded-xl group-hover:text-emeraldArch transition-colors"><Folder size={24} /></div>
                    <span className="font-bold text-sm">New Group</span>
                </button>
                <button 
                    onClick={() => activeProjectId ? createMeeting(activeProjectId) : createGroup()}
                    className="flex flex-col items-center justify-center space-y-3 p-6 bg-emeraldArch text-black rounded-2xl hover:scale-[1.02] transition-all shadow-lg shadow-emeraldArch/10"
                >
                    <div className="p-3 bg-black/10 rounded-xl"><Plus size={24} /></div>
                    <span className="font-black text-sm">New Meeting Tab</span>
                </button>
            </div>

            {recentMeetings.length > 0 && (
                <div className="w-full max-w-3xl">
                    <div className="flex items-center space-x-2 px-4 mb-4">
                        <History size={16} className="text-emeraldArch" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-textMuted">Reopen Recent Tabs</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {recentMeetings.map(m => (
                            <button 
                                key={m.id}
                                onClick={() => {
                                    setActiveProjectId(m.projectId);
                                    setActiveMeetingId(m.id);
                                    if (!expandedProjectIds.includes(m.projectId)) {
                                        setExpandedProjectIds(prev => [...prev, m.projectId]);
                                    }
                                }}
                                className="flex items-center justify-between p-4 bg-sidebarBg border border-borderMain rounded-xl hover:border-emeraldArch/30 transition-all text-left group"
                            >
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-textMain truncate group-hover:text-emeraldArch transition-colors">{m.name}</div>
                                    <div className="text-[10px] text-textMuted mt-1">
                                        {projects.find(p => p.id === m.projectId)?.name} • {new Date(m.dateCreated).toLocaleDateString()}
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-textMuted group-hover:translate-x-1 transition-transform" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
