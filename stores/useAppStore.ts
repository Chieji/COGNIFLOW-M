import create from 'zustand';
import { Note, Folder, Connection, AiSettings, PatchProposal, FeatureFlag, AuditLogEntry, View, Theme } from '../types';
import { loadAppData, saveNotes, saveFolders, saveConnections, saveSettings, saveTheme, savePatches, saveFeatureFlags, saveAuditLog, saveUIState } from '../services/storage';

interface AppStore {
  notes: Note[];
  folders: Folder[];
  connections: Connection[];
  settings: AiSettings;
  theme: Theme;
  patches: PatchProposal[];
  featureFlags: FeatureFlag[];
  auditLog: AuditLogEntry[];
  activeNoteId: string | null;
  activeFolderId: string | null;
  view: View;
  initialize: () => Promise<void>;
  setNotes: (notes: Note[]) => Promise<void>;
  setFolders: (folders: Folder[]) => Promise<void>;
  setConnections: (connections: Connection[]) => Promise<void>;
  setSettings: (settings: AiSettings) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setPatches: (patches: PatchProposal[]) => Promise<void>;
  setFeatureFlags: (featureFlags: FeatureFlag[]) => Promise<void>;
  setAuditLog: (auditLog: AuditLogEntry[]) => Promise<void>;
  setActiveNoteId: (noteId: string | null) => Promise<void>;
  setActiveFolderId: (folderId: string | null) => Promise<void>;
  setView: (view: View) => Promise<void>;
  createNote: () => Promise<void>;
  updateNote: (updatedNote: Note) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  addFolder: (name: string) => Promise<void>;
  updateFolder: (folder: Folder) => Promise<void>;
  reorderFolders: (draggedId: string, targetId: string) => Promise<void>;
}

const defaultSettings: AiSettings = {
  tasks: {
    chat: { provider: 'gemini' },
    summary: { provider: 'gemini' },
    translation: { provider: 'gemini' },
  },
  keys: {
    gemini: '',
    openai: '',
    anthropic: '',
    openrouter: '',
    groq: '',
    huggingface: '',
  },
  huggingface: {
    modelId: 'mistralai/Mistral-7B-Instruct-v0.2',
  },
};

const defaultTheme: Theme = 'dark';

const useAppStore = create<AppStore>((set, get) => ({
  notes: [],
  folders: [],
  connections: [],
  settings: defaultSettings,
  theme: defaultTheme,
  patches: [],
  featureFlags: [],
  auditLog: [],
  activeNoteId: null,
  activeFolderId: 'all',
  view: View.Notes,
  initialize: async () => {
    const data = await loadAppData();
    set({
      notes: data.notes,
      folders: data.folders,
      connections: data.connections,
      settings: data.settings,
      theme: data.theme,
      patches: data.patches,
      featureFlags: data.featureFlags,
      auditLog: data.auditLog,
      activeNoteId: data.activeNoteId,
      activeFolderId: data.activeFolderId,
      view: data.view,
    });
  },
  setNotes: async (notes) => {
    set({ notes });
    await saveNotes(notes);
  },
  setFolders: async (folders) => {
    set({ folders });
    await saveFolders(folders);
  },
  setConnections: async (connections) => {
    set({ connections });
    await saveConnections(connections);
  },
  setSettings: async (settings) => {
    set({ settings });
    await saveSettings(settings);
  },
  setTheme: async (theme) => {
    set({ theme });
    await saveTheme(theme);
  },
  setPatches: async (patches) => {
    set({ patches });
    await savePatches(patches);
  },
  setFeatureFlags: async (featureFlags) => {
    set({ featureFlags });
    await saveFeatureFlags(featureFlags);
  },
  setAuditLog: async (auditLog) => {
    set({ auditLog });
    await saveAuditLog(auditLog);
  },
  setActiveNoteId: async (noteId) => {
    set({ activeNoteId: noteId });
    const { activeFolderId, view } = get();
    await saveUIState(noteId, activeFolderId ?? 'all', view);
  },
  setActiveFolderId: async (folderId) => {
    set({ activeFolderId: folderId });
    const { activeNoteId, view } = get();
    await saveUIState(activeNoteId ?? null, folderId ?? 'all', view);
  },
  setView: async (view) => {
    set({ view });
    const { activeNoteId, activeFolderId } = get();
    await saveUIState(activeNoteId ?? null, activeFolderId ?? 'all', view);
  },
  createNote: async () => {
    const now = new Date().toISOString();
    const { activeFolderId, notes } = get();
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: 'Untitled Note',
      content: '',
      summary: '',
      tags: [],
      createdAt: now,
      updatedAt: now,
      folderId: activeFolderId && activeFolderId !== 'all' && activeFolderId !== 'uncategorized' ? activeFolderId : null,
      type: 'text',
      attachments: [],
    };
    const nextNotes = [newNote, ...notes];
    set({ notes: nextNotes, activeNoteId: newNote.id, view: View.Notes });
    await saveNotes(nextNotes);
    await saveUIState(newNote.id, activeFolderId ?? 'all', View.Notes);
  },
  updateNote: async (updatedNote) => {
    const nextNotes = get().notes.map(note => note.id === updatedNote.id ? { ...updatedNote, updatedAt: new Date().toISOString() } : note);
    set({ notes: nextNotes });
    await saveNotes(nextNotes);
  },
  deleteNote: async (id) => {
    const nextNotes = get().notes.filter(note => note.id !== id);
    const activeNoteId = get().activeNoteId === id ? null : get().activeNoteId;
    const activeFolderId = get().activeFolderId;
    const view = get().view;
    set({ notes: nextNotes, activeNoteId });
    await saveNotes(nextNotes);
    await saveUIState(activeNoteId, activeFolderId ?? 'all', view);
  },
  addFolder: async (name) => {
    const folders = get().folders;
    if (folders.some(f => f.name === name)) {
      return;
    }
    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      description: '',
    };
    const nextFolders = [...folders, newFolder];
    set({ folders: nextFolders, activeFolderId: newFolder.id });
    await saveFolders(nextFolders);
    await saveUIState(get().activeNoteId, newFolder.id, get().view);
  },
  updateFolder: async (updatedFolder) => {
    const nextFolders = get().folders.map(folder => folder.id === updatedFolder.id ? updatedFolder : folder);
    set({ folders: nextFolders });
    await saveFolders(nextFolders);
  },
  reorderFolders: async (draggedId, targetId) => {
    const folders = get().folders;
    const draggedIndex = folders.findIndex(f => f.id === draggedId);
    const targetIndex = folders.findIndex(f => f.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const nextFolders = [...folders];
    const [dragged] = nextFolders.splice(draggedIndex, 1);
    nextFolders.splice(targetIndex, 0, dragged);
    set({ folders: nextFolders });
    await saveFolders(nextFolders);
  },
}));

export default useAppStore;
