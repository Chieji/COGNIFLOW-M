import React, { useState, useRef, useEffect } from 'react';
import { AiSettings, Note, Citation, AiAction, Folder } from '../types';
import { processChatTurn } from '../services/geminiService';
import { generateSpeech } from '../services/geminiService';
import { processHuggingFaceChat } from '../services/huggingfaceService';
import { decode, decodeAudioData } from '../utils';
import Spinner from './Spinner';
import { BrainCircuitIcon, GlobeIcon, SendIcon, Volume2Icon, LoaderIcon } from './icons';

interface ChatViewProps {
  settings: AiSettings;
  notes: Note[];
  folders: Folder[];
  onAiAction: (action: AiAction) => string;
}

type Message = {
  role: 'user' | 'model';
  text: string;
  citations?: Citation[];
};

const WelcomeScreen: React.FC<{onPromptClick: (prompt: string) => void}> = ({ onPromptClick }) => {
    const examplePrompts = [
        "How is my note on 'Atomic Notes' connected to my other ideas?",
        "Explain the key concepts from my 'React State Management' note as if I'm studying for an exam.",
        "Create a folder named 'Project Alpha' and add a new note inside it with a to-do list for a new web app.",
        "Browse the web for the latest news on AI and summarize the top 3 articles.",
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <BrainCircuitIcon className="w-16 h-16 mb-4 text-gray-400 dark:text-gray-500" />
            <h3 className="text-2xl font-bold mb-2">Welcome to AI Chat</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Start a conversation with your personal AI assistant.</p>
            
            <div className="w-full max-w-2xl text-left mb-6">
                <p className="font-semibold mb-3 text-gray-700 dark:text-gray-300">Your assistant can:</p>
                <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li className="flex items-start"><GlobeIcon className="w-5 h-5 mr-3 mt-1 flex-shrink-0 text-light-accent"/><div><span className="font-semibold">Search the web</span> for real-time information.</div></li>
                    <li className="flex items-start"><BrainCircuitIcon className="w-5 h-5 mr-3 mt-1 flex-shrink-0 text-light-accent"/><div><span className="font-semibold">Analyze your knowledge graph</span> to explain connections and find insights.</div></li>
                    <li className="flex items-start"><SendIcon className="w-5 h-5 mr-3 mt-1 flex-shrink-0 text-light-accent"/><div><span className="font-semibold">Perform actions</span> like creating notes, folders, and even proposing its own code upgrades.</div></li>
                </ul>
            </div>
            
            <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-3">
                {examplePrompts.map((prompt, i) => (
                    <button 
                        key={i} 
                        onClick={() => onPromptClick(prompt)}
                        className="p-3 bg-light-surface dark:bg-dark-surface border border-light-primary dark:border-dark-secondary rounded-lg text-left text-sm hover:bg-light-secondary dark:hover:bg-dark-primary transition-colors"
                    >
                        {prompt}
                    </button>
                ))}
            </div>
        </div>
    );
}


const ChatView: React.FC<ChatViewProps> = ({ settings, notes, folders, onAiAction }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [useThinkingMode, setUseThinkingMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const provider = settings.tasks.chat.provider;
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
  const isGemini = provider === 'gemini';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMessage, { role: 'model', text: '' }]);
    setInput('');
    setIsLoading(true);
    setError(null);

    const historyForApi = messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
    }));

    try {
      if (provider === 'gemini') {
        const apiKey = settings.keys.gemini;
        if (!apiKey) throw new Error("API key for Gemini is not set. Please configure it in Settings.");
        
        const model = useThinkingMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash-lite';
        const thinkingBudget = useThinkingMode ? 32768 : null;

        const handleChunk = (textChunk: string) => {
            if (textChunk) {
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    const updatedMsg = { ...lastMsg, text: lastMsg.text + textChunk };
                    return [...prev.slice(0, -1), updatedMsg];
                });
            }
        };
        
        const { citations } = await processChatTurn(
            historyForApi, 
            textToSend, 
            apiKey, 
            useWebSearch, 
            notes, 
            folders, 
            onAiAction, 
            model, 
            thinkingBudget,
            handleChunk
        );
        
        if (citations && citations.length > 0) {
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                const updatedMsg = { ...lastMsg, citations: citations };
                return [...prev.slice(0, -1), updatedMsg];
            });
        }

      } else {
        let response: { text: string; citations?: Citation[] };
        if (provider === 'huggingface') {
            const apiKey = settings.keys.huggingface;
            const modelId = settings.huggingface.modelId;
            if (!apiKey) throw new Error("API key for Hugging Face is not set.");
            if (!modelId) throw new Error("Model ID for Hugging Face is not set.");
            response = await processHuggingFaceChat(historyForApi, textToSend, apiKey, modelId);
        } else {
            throw new Error(`Provider "${providerName}" is not currently supported for chat. AI actions, note context, and web search are only available for Gemini.`);
        }
        // Update the last (empty) message with the full response at once
        setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            const updatedMsg = { ...lastMsg, text: response.text, citations: response.citations };
            return [...prev.slice(0, -1), updatedMsg];
        });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(errorMessage);
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        const updatedMsg = { ...lastMsg, text: `Sorry, something went wrong: ${errorMessage}` };
        return [...prev.slice(0, -1), updatedMsg];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
      setInput(prompt);
  }

  const handleSpeak = async (text: string, index: number) => {
    if (isSpeaking === index) { // If it's already playing, stop it
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
        }
        setIsSpeaking(null);
        return;
    }

    setIsSpeaking(index);
    try {
        const apiKey = settings.keys.gemini;
        if (!apiKey) throw new Error("TTS requires a Gemini API key.");
        const audioData = await generateSpeech(text, apiKey);
        if (audioData) {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            const audioBuffer = await decodeAudioData(decode(audioData), audioContextRef.current, 24000, 1);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.start();
            audioSourceRef.current = source;
            source.onended = () => {
                setIsSpeaking(null);
                audioSourceRef.current = null;
            };
        }
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'TTS failed.';
        setError(errorMessage);
        setIsSpeaking(null);
    }
  };

  return (
    <div className="p-6 md:p-8 flex-1 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">AI Chat</h2>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Provider: <span className="font-bold text-light-accent">{providerName}</span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 p-4 bg-light-secondary dark:bg-dark-primary rounded-lg">
        {messages.length === 0 ? (
            <WelcomeScreen onPromptClick={handlePromptClick} />
        ) : (
            <div className="space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div 
                  className={`max-w-prose p-3 rounded-lg group relative ${
                    msg.role === 'user' 
                      ? 'bg-light-accent text-white' 
                      : 'bg-light-surface dark:bg-dark-surface'
                  }`}
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {msg.text}
                  {msg.role === 'model' && !msg.text && isLoading && index === messages.length - 1 && <Spinner />}
                   {msg.role === 'model' && isGemini && (
                        <button 
                            onClick={() => handleSpeak(msg.text, index)}
                            className="absolute -bottom-4 -right-2 p-1 bg-gray-300 dark:bg-dark-secondary rounded-full text-gray-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Read aloud"
                            disabled={isSpeaking !== null && isSpeaking !== index}
                        >
                            {isSpeaking === index ? <LoaderIcon className="w-4 h-4 animate-spin"/> : <Volume2Icon className="w-4 h-4"/>}
                        </button>
                   )}
                </div>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 max-w-prose">
                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400">Sources:</h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {msg.citations.map((citation, i) => (
                        <a 
                          key={i} 
                          href={citation.uri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs bg-gray-200 dark:bg-dark-secondary px-2 py-1 rounded-md hover:underline"
                          title={citation.title}
                        >
                          {i+1}. {new URL(citation.uri).hostname}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="mt-auto">
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        <div className="flex items-center gap-2 p-2 bg-light-surface dark:bg-dark-surface border border-light-primary dark:border-dark-secondary rounded-xl">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={ isGemini ? "e.g., 'Create a note about React hooks'" : "Ask a question..."}
            className="w-full bg-transparent p-2 focus:outline-none resize-none"
            rows={1}
            disabled={isLoading}
          />
           <label className={`flex items-center gap-2 cursor-pointer transition-opacity p-2 rounded-md hover:bg-light-secondary dark:hover:bg-dark-primary ${!isGemini ? 'opacity-50 cursor-not-allowed' : ''}`} title="Enable Web Search">
                <input 
                    type="checkbox"
                    checked={useWebSearch}
                    onChange={() => setUseWebSearch(!useWebSearch)}
                    disabled={!isGemini}
                    className="h-4 w-4 rounded border-gray-300 text-light-accent focus:ring-light-accent"
                />
                <GlobeIcon className="w-5 h-5" />
             </label>
             <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="p-2 bg-light-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SendIcon className="w-5 h-5" />
              </button>
        </div>
         <div className="flex items-center justify-between mt-2">
            {!isGemini ? (
                 <p className="text-xs text-gray-500 text-center flex-1">AI actions, web search, and thinking mode are only available when Google Gemini is the selected provider.</p>
            ): (
                <>
                    <p className="text-xs text-gray-500"></p>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-500 dark:text-gray-400">
                        <input 
                            type="checkbox"
                            checked={useThinkingMode}
                            onChange={() => setUseThinkingMode(!useThinkingMode)}
                            className="h-4 w-4 rounded border-gray-300 text-light-accent focus:ring-light-accent"
                        />
                        <span>Thinking Mode (gemini-2.5-pro)</span>
                    </label>
                </>
            )}
        </div>
      </div>
    </div>
  );
};

export default ChatView;