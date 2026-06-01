import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Note, View, Theme, Connection, Folder, AiSettings, AiAction, PatchProposal, FeatureFlag, AuditLogEntry } from './types';
import Sidebar from './components/Sidebar';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import KnowledgeGraph from './components/KnowledgeGraph';
import SettingsModal from './components/SettingsModal';
import ChatView from './components/ChatView';
import DevStudioView from './components/DevStudioView';
import { BrainCircuitIcon } from './components/icons';
import useAppStore from './stores/useAppStore';

const App: React.FC = () => {
  const notes = useAppStore(state => state.notes);
  const folders = useAppStore(state => state.folders);
  const connections = useAppStore(state => state.connections);
  const activeNoteId = useAppStore(state => state.activeNoteId);
  const activeFolderId = useAppStore(state => state.activeFolderId);
  const view = useAppStore(state => state.view);
  const theme = useAppStore(state => state.theme);
  const settings = useAppStore(state => state.settings);
  const patches = useAppStore(state => state.patches);
  const featureFlags = useAppStore(state => state.featureFlags);
  const auditLog = useAppStore(state => state.auditLog);

  const initialize = useAppStore(state => state.initialize);
  const createNote = useAppStore(state => state.createNote);
  const updateNote = useAppStore(state => state.updateNote);
  const deleteNote = useAppStore(state => state.deleteNote);
  const addFolder = useAppStore(state => state.addFolder);
  const updateFolder = useAppStore(state => state.updateFolder);
  const reorderFolders = useAppStore(state => state.reorderFolders);
  const setNotes = useAppStore(state => state.setNotes);
  const setFolders = useAppStore(state => state.setFolders);
  const setConnections = useAppStore(state => state.setConnections);
  const setSettings = useAppStore(state => state.setSettings);
  const setTheme = useAppStore(state => state.setTheme);
  const setPatches = useAppStore(state => state.setPatches);
  const setFeatureFlags = useAppStore(state => state.setFeatureFlags);
  const setAuditLog = useAppStore(state => state.setAuditLog);
  const setActiveNoteId = useAppStore(state => state.setActiveNoteId);
  const setActiveFolderId = useAppStore(state => state.setActiveFolderId);
  const setView = useAppStore(state => state.setView);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#/share/')) return;

    const importSharedNote = async () => {
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
          await setNotes([newSharedNote, ...notes]);
          setActiveNoteId(newSharedNote.id);
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        }
      } catch (e) {
        console.error('Failed to parse shared note link:', e);
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
    };

    importSharedNote();
  }, [notes, setNotes, setActiveNoteId]);

  useEffect(() => {
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Data persistence is managed centrally via Zustand actions and IndexedDB.


  const createNewNote = useCallback(() => {
    createNote();
  }, [createNote]);

  const updateNoteCallback = useCallback((updatedNote: Note) => {
    updateNote(updatedNote);
  }, [updateNote]);
  
  const deleteNoteCallback = useCallback((id: string) => {
    deleteNote(id);
  }, [deleteNote]);
  
  const addFolderCallback = useCallback((name: string) => {
    addFolder(name);
  }, [addFolder]);

  const updateFolderCallback = useCallback((updatedFolder: Folder) => {
    updateFolder(updatedFolder);
  }, [updateFolder]);

  const reorderFoldersCallback = useCallback((draggedId: string, targetId: string) => {
    reorderFolders(draggedId, targetId);
  }, [reorderFolders]);

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
            const nextNotes = notes.map(n => n.id === note_id ? { ...n, language: language || n.language, type: type || n.type } : n);
            const noteExists = notes.some(n => n.id === note_id);
            setNotes(nextNotes);
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
            setNotes([newNote, ...notes]);
            setActiveNoteId(newNote.id);
            setView(View.Notes);
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
            setFolders([...folders, newFolder]);
            return `Successfully created folder with ID ${newFolder.id}.`;
        }
        case 'delete_folder': {
            const { folder_id } = action.args;
            if (!folders.some(f => f.id === folder_id)) {
                return `Error: Folder with ID '${folder_id}' not found.`;
            }
            // Reassign notes to uncategorized
            setNotes(notes.map(n => n.folderId === folder_id ? { ...n, folderId: null } : n));
            // Delete folder
            setFolders(folders.filter(f => f.id !== folder_id));
             if (activeFolderId === folder_id) {
                setActiveFolderId('all');
            }
            return `Successfully deleted folder ${folder_id} and moved its notes.`;
        }
        case 'update_folder_description': {
            const { folder_id, description } = action.args;
            const nextFolders = folders.map(f => f.id === folder_id ? { ...f, description } : f);
            const folderExists = folders.some(f => f.id === folder_id);
            setFolders(nextFolders);
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
            setPatches([newPatch, ...patches]);
            return `Successfully proposed a new patch. You can review it in the Dev Studio.`;
        }
        case 'update_note_title': {
            const { note_id, new_title } = action.args;
            const nextNotes = notes.map(n => n.id === note_id ? { ...n, title: new_title } : n);
            const noteExists = notes.some(n => n.id === note_id);
            setNotes(nextNotes);
            return noteExists ? `Successfully updated title for note ${note_id}.` : `Error: Note with ID '${note_id}' not found.`;
        }
         case 'move_note_to_folder': {
            const { note_id, folder_id } = action.args;
             if (folder_id && !folders.some(f => f.id === folder_id)) {
                return `Error: Folder with ID '${folder_id}' does not exist.`;
            }
            const nextNotes = notes.map(n => n.id === note_id ? { ...n, folderId: folder_id || null } : n);
            const noteExists = notes.some(n => n.id === note_id);
            setNotes(nextNotes);
            return noteExists ? `Successfully moved note.` : `Error: Note with ID '${note_id}' not found.`;
        }
        case 'list_folders': {
            return `Here is a list of available folders: ${JSON.stringify(folders.map(f => ({id: f.id, name: f.name})))}`;
        }
        case 'update_note': {
            const { note_id, content } = action.args;
            const nextNotes = notes.map(n => n.id === note_id ? { ...n, content: n.content + "\n\n" + content, updatedAt: new Date().toISOString() } : n);
            const noteExists = notes.some(n => n.id === note_id);
            setNotes(nextNotes);
            return noteExists ? `Successfully appended content to note ${note_id}.` : `Error: Note with ID '${note_id}' not found.`;
        }
        case 'write_file': {
            const { note_id, content } = action.args;
            const nextNotes = notes.map(n => n.id === note_id ? { ...n, content: content, updatedAt: new Date().toISOString() } : n);
            const noteExists = notes.some(n => n.id === note_id);
            setNotes(nextNotes);
            return noteExists ? `Successfully wrote content to note ${note_id}.` : `Error: Note with ID '${note_id}' not found.`;
        }
        default:
            return `Error: Unknown tool '${action.tool}'.`;
    }
  }, [notes, folders, activeFolderId]);
  
  const handlePatchStatusChange = useCallback((patchId: string, status: 'approved' | 'rejected') => {
      setPatches(patches.map(p => p.id === patchId ? {...p, status} : p));
      const newLog: AuditLogEntry = {
          id: `log-${Date.now()}`,
          patchId,
          timestamp: new Date().toISOString(),
          status,
      };
      setAuditLog([newLog, ...auditLog]);
  }, [patches, auditLog]);
  
  const handleToggleFeatureFlag = useCallback((flagId: string) => {
      setFeatureFlags(featureFlags.map(f => f.id === flagId ? {...f, isEnabled: !f.isEnabled} : f));
  }, [featureFlags]);

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
                    const importedNotes = data.notes || [];
                    setNotes(importedNotes);
                    setFolders(data.folders || []);
                    setConnections(data.connections || []);
                    setSettings(data.settings || defaultSettings);
                    setPatches(data.patches || []);
                    setFeatureFlags(data.featureFlags || []);
                    setAuditLog(data.auditLog || []);
                    setActiveNoteId(importedNotes[0]?.id || null);
                    setActiveFolderId('all');
                    setView(View.Notes);
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
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const lowerQuery = searchQuery.toLowerCase();
    return notes.filter(note =>
      note.title.toLowerCase().includes(lowerQuery) ||
      note.content.toLowerCase().includes(lowerQuery) ||
      note.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [notes, searchQuery]);
  
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
        {view === View.Search && (
          <div className="flex flex-col flex-1 p-6 md:p-8 overflow-y-auto">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Search Notes</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Find notes by title, content, or tags.</p>
              </div>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search your notes..."
                className="w-full sm:w-96 px-4 py-2 border rounded-lg bg-white dark:bg-dark-secondary border-gray-300 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-light-accent"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {searchResults.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400">
                  No notes match your search. Try another keyword.
                </div>
              ) : searchResults.map(note => (
                <button
                  key={note.id}
                  onClick={() => setActiveNoteId(note.id)}
                  className="text-left p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-surface hover:border-light-accent transition"
                >
                  <h3 className="font-semibold text-lg">{note.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-3">{note.content}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {note.tags.map(tag => (<span key={tag} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">{tag}</span>))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {view === View.DevStudio && <DevStudioView patches={patches} featureFlags={featureFlags} auditLog={auditLog} onPatchStatusChange={handlePatchStatusChange} onToggleFeatureFlag={handleToggleFeatureFlag} />}
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={setSettings} />
    </div>
  );
};

export default App;