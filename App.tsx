
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
  History,
  Check
} from 'lucide-react';

const App: React.FC = () => {
  const [projects, setProjects] = useState<ProjectGroup[]>(() => {
    const saved = localStorage.getItem('archi_notes_v1');
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });
  
  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0]?.id || '');
  const [activeMeetingId, setActiveMeetingId] = useState<string>(projects[0]?.meetings[0]?.id || '');
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([projects[0]?.id || '']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renamingMeetingId, setRenamingMeetingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [theme, setTheme] = useState<'day' | 'night'>(() => {
    const savedTheme = localStorage.getItem('archi_theme');
    return (savedTheme as 'day' | 'night') || 'day';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('archi_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('archi_notes_v1', JSON.stringify(projects));
  }, [projects]);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const activeMeeting = activeProject?.meetings.find(m => m.id === activeMeetingId);

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
      name: 'PROJECT TITLE',
      meetings: []
    };
    setProjects(prev => [...prev, newGroup]);
    setActiveProjectId(newGroup.id);
    setExpandedProjectIds(prev => [...prev, newGroup.id]);
    setRenamingGroupId(newGroup.id);
    setSearchTerm('');
  };

  const createMeeting = (projectId: string) => {
    const newMeeting: Meeting = {
      id: crypto.randomUUID(),
      name: `MEETING TITLE`,
      dateCreated: new Date().toISOString(),
      attendees: [],
      rows: []
    };
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, meetings: [...p.meetings, newMeeting] } : p
    ));
    setActiveMeetingId(newMeeting.id);
    setActiveProjectId(projectId);
    setRenamingMeetingId(newMeeting.id);
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

  const updateGroupName = (id: string, name: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const updateMeetingName = (meetingId: string, name: string) => {
    setProjects(prev => prev.map(p => ({
      ...p,
      meetings: p.meetings.map(m => m.id === meetingId ? { ...m, name } : m)
    })));
  };

  const deleteGroup = (id: string) => {
    if (confirm('Delete this project group?')) {
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

  const closeActiveMeeting = () => setActiveMeetingId('');
  const toggleTheme = () => setTheme(prev => prev === 'night' ? 'day' : 'night');

  return (
    <div className="flex h-screen w-full bg-appBg overflow-hidden text-textMain">
      {/* Sidebar */}
      <aside className={`bg-sidebarBg transition-all duration-300 flex flex-col z-30 ${sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'}`}>
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="p-2 nm-raised rounded-xl text-emeraldArch">
               <Layout size={20} />
            </div>
            <h1 className="font-black text-xl tracking-tight whitespace-nowrap uppercase">ArchiNotes</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="nm-btn p-2 rounded-xl text-textMuted hover:text-emeraldArch transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 mb-6">
          <div className="nm-inset rounded-2xl flex items-center px-4 py-2 group">
            <Search size={16} className="text-textMuted mr-3 group-focus-within:text-emeraldArch transition-colors" />
            <input 
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none placeholder:text-textMuted/50"
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-6 space-y-8 scrollbar-hide">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-textMuted">Navigator</span>
              <button onClick={createGroup} className="nm-btn p-1 rounded-lg text-textMuted hover:text-emeraldArch">
                <Plus size={16} />
              </button>
            </div>
            
            <div className="space-y-3">
              {filteredProjects.map(project => (
                <div key={project.id} className="space-y-2">
                  <div 
                    className={`nm-btn group flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer ${activeProjectId === project.id ? 'nm-btn-active' : ''}`}
                    onClick={() => {
                        setActiveProjectId(project.id);
                        if (renamingGroupId !== project.id) {
                          toggleProjectExpansion(project.id);
                        }
                    }}
                  >
                    <div className="flex items-center space-x-3 overflow-hidden flex-1">
                      {expandedProjectIds.includes(project.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {renamingGroupId === project.id ? (
                        <input 
                          autoFocus
                          value={project.name}
                          onChange={(e) => updateGroupName(project.id, e.target.value)}
                          onBlur={() => setRenamingGroupId(null)}
                          onKeyDown={(e) => e.key === 'Enter' && setRenamingGroupId(null)}
                          className="bg-transparent text-sm font-bold focus:outline-none text-emeraldArch w-full"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className={`truncate text-sm font-bold ${activeProjectId === project.id ? 'text-emeraldArch' : ''}`}>
                            {project.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit3 
                        size={12} 
                        className="text-textMuted hover:text-emeraldArch" 
                        onClick={(e) => { e.stopPropagation(); setRenamingGroupId(project.id); }} 
                      />
                      <Trash2 
                        size={12} 
                        className="text-textMuted hover:text-red-500" 
                        onClick={(e) => { e.stopPropagation(); deleteGroup(project.id); }} 
                      />
                    </div>
                  </div>
                  
                  {expandedProjectIds.includes(project.id) && (
                    <div className="ml-4 space-y-2 animate-in slide-in-from-top-1 duration-200">
                      {project.meetings.map(meeting => (
                        <div 
                          key={meeting.id}
                          className={`flex items-center group justify-between py-2 px-4 rounded-xl cursor-pointer text-xs font-bold transition-all ${activeMeetingId === meeting.id ? 'nm-inset text-emeraldArch' : 'text-textMuted hover:text-textMain'}`}
                          onClick={() => {
                              setActiveMeetingId(meeting.id);
                              setActiveProjectId(project.id);
                          }}
                        >
                          {renamingMeetingId === meeting.id ? (
                            <input 
                              autoFocus
                              value={meeting.name}
                              onChange={(e) => updateMeetingName(meeting.id, e.target.value)}
                              onBlur={() => setRenamingMeetingId(null)}
                              onKeyDown={(e) => e.key === 'Enter' && setRenamingMeetingId(null)}
                              className="bg-transparent focus:outline-none text-emeraldArch w-full"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="truncate">{meeting.name}</span>
                          )}
                          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                             <Edit3 
                              size={12} 
                              className="hover:text-emeraldArch" 
                              onClick={(e) => { e.stopPropagation(); setRenamingMeetingId(meeting.id); }} 
                            />
                             <Trash2 
                              size={12} 
                              className="hover:text-red-500" 
                              onClick={(e) => { e.stopPropagation(); deleteMeeting(project.id, meeting.id); }} 
                            />
                          </div>
                        </div>
                      ))}
                      <button 
                        onClick={() => createMeeting(project.id)}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emeraldArch/60 hover:text-emeraldArch transition-colors"
                      >
                        + New Tab
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Theme Toggle Footer */}
        <div className="p-8 flex items-center justify-between">
          <button 
            onClick={toggleTheme}
            className="nm-btn p-3 rounded-2xl text-textMuted hover:text-emeraldArch transition-all flex items-center justify-center w-full space-x-3 font-bold text-xs"
          >
            {theme === 'night' ? <><Sun size={16} /><span>Day View</span></> : <><Moon size={16} /><span>Night View</span></>}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        {!sidebarOpen && (
            <div className="absolute top-8 left-8 z-40 flex flex-col space-y-4">
              <button onClick={() => setSidebarOpen(true)} className="nm-btn p-3 rounded-2xl text-emeraldArch"><Menu size={20} /></button>
            </div>
        )}

        {activeMeeting ? (
          <MeetingView 
            meeting={activeMeeting} 
            onUpdate={updateMeeting} 
            onClose={closeActiveMeeting}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center overflow-y-auto">
            <div className="w-32 h-32 nm-raised rounded-[40px] flex items-center justify-center text-emeraldArch mb-8 rotate-3">
                <FileText size={48} />
            </div>
            <h2 className="text-4xl font-black text-textMain mb-4 tracking-tighter uppercase">Workbench Empty</h2>
            <p className="text-textMuted max-w-sm mb-12 text-sm font-medium leading-relaxed">
                Select an architectural log from the navigator or initialize a new design session.
            </p>
            
            <div className="flex space-x-6">
                <button onClick={createGroup} className="nm-btn px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:text-emeraldArch transition-colors">New Group</button>
                <button onClick={() => activeProjectId ? createMeeting(activeProjectId) : createGroup()} className="nm-emerald px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-transform hover:scale-105 active:scale-95">Quick Start</button>
            </div>
            
            {recentMeetings.length > 0 && (
                <div className="w-full max-w-2xl mt-20">
                    <div className="flex items-center space-x-3 mb-6">
                        <History size={16} className="text-emeraldArch" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-textMuted">Recently Drafted</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        {recentMeetings.map(m => (
                            <button 
                                key={m.id}
                                onClick={() => { setActiveProjectId(m.projectId); setActiveMeetingId(m.id); }}
                                className="nm-btn p-6 rounded-3xl text-left group transition-all hover:scale-[1.02]"
                            >
                                <div className="text-sm font-black text-textMain truncate mb-1">{m.name}</div>
                                <div className="text-[10px] text-textMuted font-bold uppercase tracking-widest">
                                    {projects.find(p => p.id === m.projectId)?.name}
                                </div>
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
