import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Note, View, Theme, Connection, Folder, AiSettings, AiAction, PatchProposal, FeatureFlag, AuditLogEntry } from './types';
import Sidebar from './components/Sidebar';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import KnowledgeGraph from './components/KnowledgeGraph';
import SettingsModal from './components/SettingsModal';
import ChatView from './components/ChatView';
import DevStudioView from './components/DevStudioView';
import { initialNotes, initialFolders, initialPatches, initialFeatureFlags, initialAuditLog } from './constants';
import { BrainCircuitIcon } from './components/icons';

const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>('all');
  const [view, setView] = useState<View>(View.Notes);
  const [theme, setTheme] = useState<Theme>('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AiSettings>({
    tasks: {
      chat: { provider: 'gemini' },
      summary: { provider: 'gemini' },
      translation: { provider: 'gemini' },
    },
    keys: { gemini: '', openai: '', anthropic: '', openrouter: '', groq: '', huggingface: '' },
    huggingface: { modelId: 'mistralai/Mistral-7B-Instruct-v0.2' },
  });

  // Dev Studio State
  const [patches, setPatches] = useState<PatchProposal[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);


  useEffect(() => {
    const defaultSettings: AiSettings = {
        tasks: { chat: { provider: 'gemini' }, summary: { provider: 'gemini' }, translation: { provider: 'gemini' } },
        keys: { gemini: '', openai: '', anthropic: '', openrouter: '', groq: '', huggingface: '' },
        huggingface: { modelId: 'mistralai/Mistral-7B-Instruct-v0.2' },
    };
    // App data
    const savedNotes = JSON.parse(localStorage.getItem('notes') || 'null') || initialNotes;
    setNotes(savedNotes);
    setFolders(JSON.parse(localStorage.getItem('folders') || 'null') || initialFolders);
    setConnections(JSON.parse(localStorage.getItem('connections') || 'null') || []);
    setTheme((localStorage.getItem('theme') as Theme) || 'dark');
    setSettings(JSON.parse(localStorage.getItem('aiSettings') || 'null') || defaultSettings);
    
    // Dev Studio data
    setPatches(JSON.parse(localStorage.getItem('patches') || 'null') || initialPatches);
    setFeatureFlags(JSON.parse(localStorage.getItem('featureFlags') || 'null') || initialFeatureFlags);
    setAuditLog(JSON.parse(localStorage.getItem('auditLog') || 'null') || initialAuditLog);
    
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Handle shared note URL on initial load
    const hash = window.location.hash;
    if (hash.startsWith('#/share/')) {
        try {
            const encodedData = hash.substring(8);
            const decodedString = atob(encodedData);
            const sharedNoteData = JSON.parse(decodedString);
            
            if (sharedNoteData.title && typeof sharedNoteData.content !== 'undefined') {
                 const newSharedNote: Note = {
                    id: `shared-${Date.now()}`,
                    title: `[Shared] ${sharedNoteData.title}`,
                    content: sharedNoteData.content,
                    summary: '',
                    tags: ['shared'],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    folderId: null,
                    type: 'text',
                    attachments: [],
                };
                setNotes(prev => [newSharedNote, ...prev]);
                setActiveNoteId(newSharedNote.id);
                // Clean the URL
                window.history.replaceState(null, '', ' ');
            }
        } catch (e) {
            console.error("Failed to parse shared note link:", e);
             window.history.replaceState(null, '', ' ');
        }
    } else if (savedNotes.length > 0 && !activeNoteId) {
        setActiveNoteId(savedNotes[0].id);
    }
  }, []);

  const saveToLocalStorage = useCallback((key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  }, []);

  useEffect(() => saveToLocalStorage('notes', notes), [notes, saveToLocalStorage]);
  useEffect(() => saveToLocalStorage('folders', folders), [folders, saveToLocalStorage]);
  useEffect(() => saveToLocalStorage('connections', connections), [connections, saveToLocalStorage]);
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  }, [theme]);
   useEffect(() => saveToLocalStorage('aiSettings', settings), [settings, saveToLocalStorage]);
   useEffect(() => saveToLocalStorage('patches', patches), [patches, saveToLocalStorage]);
   useEffect(() => saveToLocalStorage('featureFlags', featureFlags), [featureFlags, saveToLocalStorage]);
   useEffect(() => saveToLocalStorage('auditLog', auditLog), [auditLog, saveToLocalStorage]);


  const createNewNote = useCallback(() => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: 'Untitled Note',
      content: '',
      summary: '',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      folderId: (activeFolderId && activeFolderId !== 'all' && activeFolderId !== 'uncategorized') ? activeFolderId : null,
      type: 'text',
      attachments: [],
    };
    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    setView(View.Notes);
  }, [activeFolderId]);

  const updateNote = useCallback((updatedNote: Note) => {
    setNotes(prev => prev.map(note => note.id === updatedNote.id ? { ...updatedNote, updatedAt: new Date().toISOString() } : note));
  }, []);
  
  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(note => note.id !== id));
    if (activeNoteId === id) {
      setActiveNoteId(null);
    }
  }, [activeNoteId]);
  
  const addFolder = useCallback((name: string) => {
    if (folders.some(f => f.name === name)) {
      alert("A folder with this name already exists.");
      return;
    }
    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      name: name,
      createdAt: new Date().toISOString(),
      description: ''
    };
    setFolders(prev => [...prev, newFolder]);
    setActiveFolderId(newFolder.id);
  }, [folders]);

  const updateFolder = useCallback((updatedFolder: Folder) => {
    setFolders(prev => prev.map(f => f.id === updatedFolder.id ? updatedFolder : f));
  }, []);

  const reorderFolders = useCallback((draggedId: string, targetId: string) => {
    setFolders(prev => {
        const draggedIndex = prev.findIndex(f => f.id === draggedId);
        const targetIndex = prev.findIndex(f => f.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return prev;

        const newFolders = [...prev];
        const [draggedItem] = newFolders.splice(draggedIndex, 1);
        newFolders.splice(targetIndex, 0, draggedItem);
        return newFolders;
    });
  }, []);

  const handleAiAction = useCallback((action: AiAction): string => {
    switch (action.tool) {
        case 'get_note_content': {
            const { note_id } = action.args;
            const note = notes.find(n => n.id === note_id);
            if (!note) return `Error: Note with ID '${note_id}' not found.`;
            return `Here is the content of the note titled "${note.title}":\n\n${note.content}`;
        }
        case 'set_note_metadata': {
            const { note_id, language, type } = action.args;
            let noteExists = false;
            setNotes(prev => prev.map(n => {
                if (n.id === note_id) {
                    noteExists = true;
                    return { ...n, language: language || n.language, type: type || n.type };
                }
                return n;
            }));
            return noteExists ? `Successfully updated metadata for note ${note_id}.` : `Error: Note with ID '${note_id}' not found.`;
        }
        case 'create_note': {
            const { title, content, folder_id } = action.args;
            
            const confirmationMessage = `The AI wants to create a new note with the following details:\n\nTitle: ${title}\n\nContent:\n${content.substring(0, 200)}${content.length > 200 ? '...' : ''}\n\nDo you want to proceed?`;
            
            if (!window.confirm(confirmationMessage)) {
                return "Note creation cancelled by user.";
            }

            if (folder_id && !folders.some(f => f.id === folder_id)) {
                return `Error: Folder with ID '${folder_id}' does not exist.`;
            }
            const newNote: Note = {
                id: `note-${Date.now()}`,
                title,
                content,
                summary: '',
                tags: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                folderId: folder_id || null,
                type: 'text',
                attachments: [],
            };
            setNotes(prev => [newNote, ...prev]);
            return `Successfully created note with ID ${newNote.id}.`;
        }
        case 'create_folder': {
             const { name } = action.args;
             if (folders.some(f => f.name === name)) {
                return `Error: A folder named '${name}' already exists.`;
            }
            const newFolder: Folder = {
                id: `folder-${Date.now()}`,
                name: name,
                createdAt: new Date().toISOString(),
                description: '',
            };
            setFolders(prev => [...prev, newFolder]);
            return `Successfully created folder with ID ${newFolder.id}.`;
        }
        case 'delete_folder': {
            const { folder_id } = action.args;
            if (!folders.some(f => f.id === folder_id)) {
                return `Error: Folder with ID '${folder_id}' not found.`;
            }
            // Reassign notes to uncategorized
            setNotes(prev => prev.map(n => n.folderId === folder_id ? { ...n, folderId: null } : n));
            // Delete folder
            setFolders(prev => prev.filter(f => f.id !== folder_id));
             if (activeFolderId === folder_id) {
                setActiveFolderId('all');
            }
            return `Successfully deleted folder ${folder_id} and moved its notes.`;
        }
        case 'update_folder_description': {
            const { folder_id, description } = action.args;
            let folderExists = false;
            setFolders(prev => prev.map(f => {
                if (f.id === folder_id) {
                    folderExists = true;
                    return { ...f, description };
                }
                return f;
            }));
            return folderExists ? `Successfully updated description for folder ${folder_id}.` : `Error: Folder with ID '${folder_id}' not found.`;
        }
        case 'propose_code_patch': {
            const { title, description, code_diff, tests } = action.args;
            const newPatch: PatchProposal = {
                id: `patch-${Date.now()}`,
                title,
                description,
                codeDiff: code_diff,
                tests,
                status: 'pending',
                createdAt: new Date().toISOString(),
                modelUsed: 'gemini',
            };
            setPatches(prev => [newPatch, ...prev]);
            return `Successfully proposed a new patch. You can review it in the Dev Studio.`;
        }
        case 'update_note_title': {
            const { note_id, new_title } = action.args;
            let noteExists = false;
            setNotes(prev => prev.map(n => {
                if (n.id === note_id) {
                    noteExists = true;
                    return { ...n, title: new_title };
                }
                return n;
            }));
            return noteExists ? `Successfully updated title for note ${note_id}.` : `Error: Note with ID '${note_id}' not found.`;
        }
         case 'move_note_to_folder': {
            const { note_id, folder_id } = action.args;
             if (folder_id && !folders.some(f => f.id === folder_id)) {
                return `Error: Folder with ID '${folder_id}' does not exist.`;
            }
            let noteExists = false;
            setNotes(prev => prev.map(n => {
                if (n.id === note_id) {
                    noteExists = true;
                    return { ...n, folderId: folder_id || null };
                }
                return n;
            }));
            return noteExists ? `Successfully moved note.` : `Error: Note with ID '${note_id}' not found.`;
        }
        case 'list_folders': {
            return `Here is a list of available folders: ${JSON.stringify(folders.map(f => ({id: f.id, name: f.name})))}`;
        }
        case 'update_note': {
            const { note_id, content } = action.args;
            let noteExists = false;
            setNotes(prev => prev.map(n => {
                if (n.id === note_id) {
                    noteExists = true;
                    return { ...n, content: n.content + "\n\n" + content, updatedAt: new Date().toISOString() };
                }
                return n;
            }));
            return noteExists ? `Successfully appended content to note ${note_id}.` : `Error: Note with ID '${note_id}' not found.`;
        }
        case 'write_file': {
            const { note_id, content } = action.args;
            let noteExists = false;
            setNotes(prev => prev.map(n => {
                if (n.id === note_id) {
                    noteExists = true;
                    return { ...n, content: content, updatedAt: new Date().toISOString() };
                }
                return n;
            }));
            return noteExists ? `Successfully wrote content to note ${note_id}.` : `Error: Note with ID '${note_id}' not found.`;
        }
        default:
            return `Error: Unknown tool '${action.tool}'.`;
    }
  }, [notes, folders, activeFolderId]);
  
  const handlePatchStatusChange = useCallback((patchId: string, status: 'approved' | 'rejected') => {
      setPatches(prev => prev.map(p => p.id === patchId ? {...p, status} : p));
      const newLog: AuditLogEntry = {
          id: `log-${Date.now()}`,
          patchId,
          timestamp: new Date().toISOString(),
          status,
      };
      setAuditLog(prev => [newLog, ...prev]);
  }, []);
  
  const handleToggleFeatureFlag = useCallback((flagId: string) => {
      setFeatureFlags(prev => prev.map(f => f.id === flagId ? {...f, isEnabled: !f.isEnabled} : f));
  }, []);

  const onExport = useCallback(() => {
    const data = {
        notes,
        folders,
        connections,
        settings,
        patches,
        featureFlags,
        auditLog,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cogniflow-export-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [notes, folders, connections, settings, patches, featureFlags, auditLog]);

  const onImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const result = event.target?.result;
                if (typeof result !== 'string') {
                    throw new Error("File could not be read.");
                }
                const data = JSON.parse(result);
                
                const defaultSettings: AiSettings = {
                    tasks: { chat: { provider: 'gemini' }, summary: { provider: 'gemini' }, translation: { provider: 'gemini' } },
                    keys: { gemini: '', openai: '', anthropic: '', openrouter: '', groq: '', huggingface: '' },
                    huggingface: { modelId: 'mistralai/Mistral-7B-Instruct-v0.2' },
                };

                // Basic validation
                if (!data.notes || !data.folders || !data.settings) {
                    throw new Error("Invalid Cogniflow export file format.");
                }

                if (window.confirm("This will replace all your current data. This action cannot be undone. Are you sure you want to continue?")) {
                    setNotes(data.notes || []);
                    setFolders(data.folders || []);
                    setConnections(data.connections || []);
                    setSettings(data.settings || defaultSettings);
                    setPatches(data.patches || []);
                    setFeatureFlags(data.featureFlags || []);
                    setAuditLog(data.auditLog || []);
                    alert("Data imported successfully!");
                }
            } catch (error) {
                console.error("Failed to import data:", error);
                alert(`Error importing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        };
        reader.readAsText(file);
    };
    input.click();
  }, []);

  const activeNote = useMemo(() => notes.find(note => note.id === activeNoteId), [notes, activeNoteId]);
  
  const filteredNotes = useMemo(() => {
    if (!activeFolderId || activeFolderId === 'all') return notes;
    if (activeFolderId === 'uncategorized') return notes.filter(n => !n.folderId);
    return notes.filter(n => n.folderId === activeFolderId);
  }, [notes, activeFolderId]);

  return (
    <div className="flex h-screen w-screen bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text font-sans">
      <Sidebar 
        view={view} 
        setView={setView} 
        theme={theme} 
        setTheme={setTheme}
        createNewNote={createNewNote}
        folders={folders}
        notes={notes}
        addFolder={addFolder}
        activeFolderId={activeFolderId}
        setActiveFolderId={setActiveFolderId}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExport={onExport}
        onImport={onImport}
        reorderFolders={reorderFolders}
      />
      <main className="flex-1 flex flex-col min-w-0">
        {view === View.Notes && (
          <div className="flex flex-1 min-h-0">
            <NoteList 
              notes={filteredNotes}
              activeNoteId={activeNoteId}
              setActiveNoteId={setActiveNoteId}
              deleteNote={deleteNote}
              isHiddenMobile={!!activeNote}
              folders={folders}
              activeFolderId={activeFolderId}
              updateFolder={updateFolder}
              addFolder={addFolder}
            />
            <div className={`flex-1 ${!activeNote ? 'hidden md:flex' : 'flex'}`}>
              {activeNote ? (
                <NoteEditor 
                    note={activeNote} 
                    updateNote={updateNote} 
                    settings={settings}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <BrainCircuitIcon className="w-16 h-16 mb-4 text-gray-400 dark:text-gray-500" />
                    <h3 className="text-xl font-semibold">Select a note to view or edit</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Or, create a new note to start capturing your thoughts.</p>
                </div>
              )}
            </div>
          </div>
        )}
        {view === View.Graph && <KnowledgeGraph notes={notes} connections={connections} setConnections={setConnections} settings={settings} setActiveNoteId={setActiveNoteId} setView={setView} />}
        {view === View.Chat && <ChatView settings={settings} notes={notes} folders={folders} onAiAction={handleAiAction} />}
        {view === View.DevStudio && <DevStudioView patches={patches} featureFlags={featureFlags} auditLog={auditLog} onPatchStatusChange={handlePatchStatusChange} onToggleFeatureFlag={handleToggleFeatureFlag} />}
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={setSettings} />
    </div>
  );
};

export default App;