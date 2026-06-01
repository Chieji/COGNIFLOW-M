import Dexie, { Table } from 'dexie';
import { Note, Folder, Connection, AiSettings, PatchProposal, FeatureFlag, AuditLogEntry, Theme, View } from '../types';
import { initialNotes, initialFolders, initialPatches, initialFeatureFlags, initialAuditLog } from '../constants';

interface SettingsRecord {
  id: 'settings';
  value: AiSettings;
}

interface ThemeRecord {
  id: 'theme';
  value: Theme;
}

interface UiStateRecord {
  id: 'ui';
  activeNoteId: string | null;
  activeFolderId: string;
  view: View;
}

interface ConnectionRecord extends Connection {
  id?: number;
}

export class CogniflowDatabase extends Dexie {
  notes!: Table<Note, string>;
  folders!: Table<Folder, string>;
  connections!: Table<ConnectionRecord, number>;
  settings!: Table<SettingsRecord, string>;
  theme!: Table<ThemeRecord, string>;
  uiState!: Table<UiStateRecord, string>;
  patches!: Table<PatchProposal, string>;
  featureFlags!: Table<FeatureFlag, string>;
  auditLog!: Table<AuditLogEntry, string>;

  constructor() {
    super('CogniflowDB');
    this.version(1).stores({
      notes: 'id,title,createdAt,updatedAt,*tags,folderId',
      folders: 'id,name,createdAt',
      connections: '++id,source,target',
      settings: 'id',
      theme: 'id',
      uiState: 'id',
      patches: 'id',
      featureFlags: 'id',
      auditLog: 'id',
    });
  }
}

export const db = new CogniflowDatabase();

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

const loadLocalStorageJSON = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const migrateLocalStorageToDexie = async () => {
  try {
    const notes = loadLocalStorageJSON<Note[]>('notes', initialNotes);
    const folders = loadLocalStorageJSON<Folder[]>('folders', initialFolders);
    const connections = loadLocalStorageJSON<Connection[]>('connections', []);
    const settings = loadLocalStorageJSON<AiSettings>('aiSettings', defaultSettings);
    const theme = (localStorage.getItem('theme') as Theme) || defaultTheme;
    const patches = loadLocalStorageJSON<PatchProposal[]>('patches', initialPatches);
    const featureFlags = loadLocalStorageJSON<FeatureFlag[]>('featureFlags', initialFeatureFlags);
    const auditLog = loadLocalStorageJSON<AuditLogEntry[]>('auditLog', initialAuditLog);
    const activeNoteId = localStorage.getItem('activeNoteId');
    const activeFolderId = localStorage.getItem('activeFolderId') || 'all';
    const view = (localStorage.getItem('view') as View) || View.Notes;

    await db.notes.clear();
    await db.notes.bulkPut(notes);
    await db.folders.clear();
    await db.folders.bulkPut(folders);
    await db.connections.clear();
    await db.connections.bulkPut(connections.map((connection) => ({ ...connection })));
    await db.settings.clear();
    await db.settings.put({ id: 'settings', value: settings });
    await db.theme.clear();
    await db.theme.put({ id: 'theme', value: theme });
    await db.uiState.clear();
    await db.uiState.put({ id: 'ui', activeNoteId, activeFolderId, view });
    await db.patches.clear();
    await db.patches.bulkPut(patches);
    await db.featureFlags.clear();
    await db.featureFlags.bulkPut(featureFlags);
    await db.auditLog.clear();
    await db.auditLog.bulkPut(auditLog);
  } catch (error) {
    console.warn('Failed to migrate from localStorage to IndexedDB:', error);
  }
};

const loadFallbackData = async () => {
  return {
    notes: loadLocalStorageJSON<Note[]>('notes', initialNotes),
    folders: loadLocalStorageJSON<Folder[]>('folders', initialFolders),
    connections: loadLocalStorageJSON<Connection[]>('connections', []),
    settings: loadLocalStorageJSON<AiSettings>('aiSettings', defaultSettings),
    theme: (localStorage.getItem('theme') as Theme) || defaultTheme,
    patches: loadLocalStorageJSON<PatchProposal[]>('patches', initialPatches),
    featureFlags: loadLocalStorageJSON<FeatureFlag[]>('featureFlags', initialFeatureFlags),
    auditLog: loadLocalStorageJSON<AuditLogEntry[]>('auditLog', initialAuditLog),
    activeNoteId: localStorage.getItem('activeNoteId'),
    activeFolderId: localStorage.getItem('activeFolderId') || 'all',
    view: (localStorage.getItem('view') as View) || View.Notes,
  };
};

export const loadAppData = async () => {
  try {
    await db.open();
    const noteCount = await db.notes.count();
    if (noteCount === 0) {
      await migrateLocalStorageToDexie();
    }
    const [notes, folders, connections, settingsRecord, themeRecord, uiState, patches, featureFlags, auditLog] = await Promise.all([
      db.notes.toArray(),
      db.folders.toArray(),
      db.connections.toArray(),
      db.settings.get('settings'),
      db.theme.get('theme'),
      db.uiState.get('ui'),
      db.patches.toArray(),
      db.featureFlags.toArray(),
      db.auditLog.toArray(),
    ]);

    return {
      notes: notes.length > 0 ? notes : initialNotes,
      folders: folders.length > 0 ? folders : initialFolders,
      connections,
      settings: settingsRecord?.value ?? defaultSettings,
      theme: themeRecord?.value ?? defaultTheme,
      patches: patches.length > 0 ? patches : initialPatches,
      featureFlags: featureFlags.length > 0 ? featureFlags : initialFeatureFlags,
      auditLog: auditLog.length > 0 ? auditLog : initialAuditLog,
      activeNoteId: uiState?.activeNoteId ?? (notes.length > 0 ? notes[0].id : null),
      activeFolderId: uiState?.activeFolderId ?? 'all',
      view: uiState?.view ?? View.Notes,
    };
  } catch (error) {
    console.warn('IndexedDB unavailable, falling back to localStorage.', error);
    return loadFallbackData();
  }
};

export const saveNotes = async (notes: Note[]) => {
  try {
    await db.notes.clear();
    await db.notes.bulkPut(notes);
  } catch (error) {
    console.warn('Failed to persist notes to IndexedDB:', error);
  }
};

export const saveFolders = async (folders: Folder[]) => {
  try {
    await db.folders.clear();
    await db.folders.bulkPut(folders);
  } catch (error) {
    console.warn('Failed to persist folders to IndexedDB:', error);
  }
};

export const saveConnections = async (connections: Connection[]) => {
  try {
    await db.connections.clear();
    await db.connections.bulkPut(connections.map((connection) => ({ ...connection })));
  } catch (error) {
    console.warn('Failed to persist connections to IndexedDB:', error);
  }
};

export const saveSettings = async (settings: AiSettings) => {
  try {
    await db.settings.put({ id: 'settings', value: settings });
  } catch (error) {
    console.warn('Failed to persist settings to IndexedDB:', error);
  }
};

export const saveTheme = async (theme: Theme) => {
  try {
    await db.theme.put({ id: 'theme', value: theme });
  } catch (error) {
    console.warn('Failed to persist theme to IndexedDB:', error);
  }
};

export const savePatches = async (patches: PatchProposal[]) => {
  try {
    await db.patches.clear();
    await db.patches.bulkPut(patches);
  } catch (error) {
    console.warn('Failed to persist patches to IndexedDB:', error);
  }
};

export const saveFeatureFlags = async (featureFlags: FeatureFlag[]) => {
  try {
    await db.featureFlags.clear();
    await db.featureFlags.bulkPut(featureFlags);
  } catch (error) {
    console.warn('Failed to persist feature flags to IndexedDB:', error);
  }
};

export const saveAuditLog = async (auditLog: AuditLogEntry[]) => {
  try {
    await db.auditLog.clear();
    await db.auditLog.bulkPut(auditLog);
  } catch (error) {
    console.warn('Failed to persist audit log to IndexedDB:', error);
  }
};

export const saveUIState = async (activeNoteId: string | null, activeFolderId: string, view: View) => {
  try {
    await db.uiState.put({ id: 'ui', activeNoteId, activeFolderId, view });
  } catch (error) {
    console.warn('Failed to persist UI state to IndexedDB:', error);
  }
};
