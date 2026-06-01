import React, { useState, useEffect, useRef } from 'react';
import { Note, Attachment, AiSettings } from '../types';
import { summarizeAndTagNote, analyzeVisualMedia, generateSpeech } from '../services/geminiService';
import { decode, decodeAudioData, blobToBase64 } from '../utils';
import Tag from './Tag';
import Spinner from './Spinner';
import { SparklesIcon, PaperclipIcon, CameraIcon, MicIcon, XCircleIcon, PlayCircleIcon, BrainCircuitIcon, LoaderIcon, Volume2Icon, Share2Icon } from './icons';

interface NoteEditorProps {
  note: Note;
  settings: AiSettings;
  updateNote: (note: Note) => void;
}

const LanguageBadge: React.FC<{ language: string }> = ({ language }) => (
    <span className="ml-2 px-2 py-0.5 bg-gray-200 dark:bg-dark-secondary text-xs font-semibold rounded-full text-gray-500 dark:text-gray-300 capitalize">{language}</span>
);

const NoteEditor: React.FC<NoteEditorProps> = ({ note, settings, updateNote }) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCapturing, setIsCapturing] = useState<'camera' | 'audio' | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
  }, [note]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (note.title !== title || note.content !== content) {
        updateNote({ ...note, title, content });
      }
    }, 500); // Debounce saves

    return () => clearTimeout(handler);
  }, [title, content, note, updateNote]);

  const addAttachment = (attachment: Omit<Attachment, 'id'>) => {
    const newAttachment: Attachment = { ...attachment, id: `att-${Date.now()}` };
    updateNote({ ...note, attachments: [...note.attachments, newAttachment] });
  };
  
  const removeAttachment = (id: string) => {
     updateNote({ ...note, attachments: note.attachments.filter(att => att.id !== id) });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    if (files.length > 1) {
        if (!window.confirm(`You are about to upload ${files.length} files. Do you want to proceed?`)) {
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            return;
        }
    }

    const newAttachments: Omit<Attachment, 'id'>[] = [];
    let processedFiles = 0;

    const onAllFilesProcessed = () => {
        const finalAttachments: Attachment[] = newAttachments.map((att, index) => ({
            ...att,
            id: `att-${Date.now()}-${index}`
        }));
        updateNote({ ...note, attachments: [...note.attachments, ...finalAttachments] });
    };

    // FIX: Replaced for...of loop with a standard for loop. This resolves a TypeScript
    // type inference issue where `file` was being inferred as `unknown`, ensuring
    // that properties like `type` and `name` are correctly recognized.
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                let type: Attachment['type'] = 'file';
                if (file.type.startsWith('image/')) type = 'image';
                if (file.type.startsWith('audio/')) type = 'audio';
                if (file.type.startsWith('video/')) type = 'video';
                newAttachments.push({
                    type: type,
                    url: e.target.result as string,
                    name: file.name,
                    mimeType: file.type,
                });
            }
            processedFiles++;
            if (processedFiles === files.length) {
                onAllFilesProcessed();
            }
        };
        reader.readAsDataURL(file);
    }
  };
  
  const handleGenerateInsights = async () => {
    setIsInsightsLoading(true);
    setInsightsError(null);
    try {
        const apiKey = settings.keys.gemini;
        if (!apiKey) {
            throw new Error("API key for Gemini is not configured. Please set it in Settings.");
        }
        const result = await summarizeAndTagNote(content, apiKey);
        if (result) {
            updateNote({ ...note, summary: result.summary, tags: result.tags });
        }
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
        setInsightsError(errorMessage);
    } finally {
        setIsInsightsLoading(false);
    }
  };

  const handleAnalyzeAttachment = async (attachment: Attachment) => {
    setIsAnalyzing(attachment.id);
    setAnalysisError(null);
    try {
        const apiKey = settings.keys.gemini;
        if (!apiKey) throw new Error("Gemini API key is not set.");

        let analysisResult = '';
        if (attachment.type === 'image') {
            const base64Data = attachment.url.split(',')[1];
            analysisResult = await analyzeVisualMedia(
                "Describe this image in detail.",
                [{ mimeType: attachment.mimeType, data: base64Data }],
                apiKey,
                'gemini-2.5-flash'
            );
        } else if (attachment.type === 'video') {
             const videoBlob = await fetch(attachment.url).then(r => r.blob());
             const frames = await extractFramesFromVideo(videoBlob, 5);
             analysisResult = await analyzeVisualMedia(
                "These are sequential frames from a video. Describe what is happening in the video.",
                frames.map(frame => ({ mimeType: 'image/jpeg', data: frame })),
                apiKey,
                'gemini-2.5-pro'
            );
        }
        
        if (analysisResult) {
            const formattedResult = `\n\n--- AI Analysis of ${attachment.name} ---\n${analysisResult}\n--- End of Analysis ---`;
            setContent(prev => prev + formattedResult);
        }

    } catch(e) {
        const errorMessage = e instanceof Error ? e.message : 'Analysis failed.';
        setAnalysisError(errorMessage);
    } finally {
        setIsAnalyzing(null);
    }
  };

  const extractFramesFromVideo = async (videoBlob: Blob, frameCount: number): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoBlob);
        video.muted = true;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const frames: string[] = [];

        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const duration = video.duration;
            if (duration === 0) {
              // Can happen with some video formats on some browsers. Capture first frame.
              video.currentTime = 0;
              return;
            }
            let capturedFrames = 0;

            const captureFrame = () => {
                if (!context) {
                    reject(new Error("Canvas context is not available."));
                    return;
                }
                context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                canvas.toBlob(async (blob) => {
                    if (blob) {
                        frames.push(await blobToBase64(blob));
                        capturedFrames++;
                        if (capturedFrames >= frameCount) {
                            URL.revokeObjectURL(video.src);
                            resolve(frames);
                        } else {
                            video.currentTime += duration / frameCount;
                        }
                    }
                }, 'image/jpeg');
            };

            video.onseeked = captureFrame;
            video.currentTime = 0.01; // Start capturing from the beginning
        };

        video.onerror = (e) => {
            reject(new Error('Failed to load video for frame extraction.'));
        };
    });
};

  const handleTextToSpeech = async (text: string) => {
    if (isSpeaking) {
        if(audioSourceRef.current) audioSourceRef.current.stop();
        setIsSpeaking(false);
        return;
    }
    if (!text.trim()) return;

    setIsSpeaking(true);
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
                setIsSpeaking(false);
                audioSourceRef.current = null;
            };
        }
    } catch(e) {
        const errorMessage = e instanceof Error ? e.message : 'TTS failed.';
        setInsightsError(errorMessage); // Reuse insights error display for TTS errors
        setIsSpeaking(false);
    }
  };


  const handleCapturePhoto = () => {
    if (videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        addAttachment({ type: 'image', url: dataUrl, name: `capture-${new Date().toISOString()}.png`, mimeType: 'image/png' });
        stopMediaStreams();
    }
  };
  
  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        setMediaRecorder(recorder);
        recorder.start();
        setIsCapturing('audio');

        recorder.addEventListener('dataavailable', (event) => {
            const audioUrl = URL.createObjectURL(event.data);
            addAttachment({ type: 'audio', url: audioUrl, name: `recording-${new Date().toISOString()}.webm`, mimeType: event.data.type });
        });
    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Microphone access was denied. Please allow it in your browser settings.");
    }
  };
  
  const stopRecording = () => {
      if (mediaRecorder) {
          mediaRecorder.stop();
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
          setMediaRecorder(null);
          setIsCapturing(null);
      }
  };

  const startCamera = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if(videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
        }
        setIsCapturing('camera');
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Camera access was denied. Please allow it in your browser settings.");
    }
  };

  const stopMediaStreams = () => {
    if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
    }
    if (mediaRecorder) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        setMediaRecorder(null);
    }
    setIsCapturing(null);
  };

  const handleShareNote = () => {
    try {
        const dataToShare = {
            title,
            content,
        };
        const jsonString = JSON.stringify(dataToShare);
        const encodedData = btoa(jsonString);
        const url = `${window.location.origin}${window.location.pathname}#/share/${encodedData}`;
        
        navigator.clipboard.writeText(url);
        setIsLinkCopied(true);
        setTimeout(() => setIsLinkCopied(false), 2000);
    } catch (e) {
        console.error("Failed to create share link:", e);
        alert("Could not copy link to clipboard.");
    }
  };


  const AttachmentPreview: React.FC<{ attachment: Attachment, onRemove: (id: string) => void, onAnalyze: (attachment: Attachment) => void, isAnalyzing: boolean }> = ({ attachment, onRemove, onAnalyze, isAnalyzing }) => {
    const canAnalyze = attachment.type === 'image' || attachment.type === 'video';
    return (
        <div className="relative group bg-light-secondary dark:bg-dark-primary rounded-lg p-2 flex items-center gap-3">
             <button onClick={() => onRemove(attachment.id)} className="absolute top-1 right-1 z-10 p-0.5 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <XCircleIcon className="w-5 h-5" />
            </button>
            {attachment.type === 'image' && <img src={attachment.url} alt={attachment.name} className="w-16 h-16 object-cover rounded" />}
            {attachment.type === 'video' && <video src={attachment.url} className="w-16 h-16 object-cover rounded" />}
            {attachment.type === 'audio' && <audio src={attachment.url} controls className="w-full" />}
            <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{attachment.name}</p>
                <div className="flex items-center gap-4 mt-1">
                    <p className="text-xs text-gray-500">{attachment.mimeType}</p>
                    {canAnalyze && (
                         <button 
                            onClick={() => onAnalyze(attachment)} 
                            disabled={isAnalyzing}
                            className="text-xs font-semibold text-light-accent hover:underline disabled:opacity-50 flex items-center"
                        >
                            {isAnalyzing ? <><LoaderIcon className="w-4 h-4 mr-1 animate-spin" /> Analyzing...</> : <><BrainCircuitIcon className="w-4 h-4 mr-1" /> Analyze</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-light-surface dark:bg-dark-surface">
      <div className="p-4 border-b border-light-primary dark:border-dark-primary flex items-center justify-between gap-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note Title"
          className="w-full text-2xl font-bold bg-transparent focus:outline-none"
        />
        <div className="flex items-center gap-2">
            <button
                onClick={handleShareNote}
                title="Share note"
                className="p-2 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary"
            >
                <Share2Icon className="w-5 h-5" />
            </button>
            {isLinkCopied && <span className="text-sm text-green-500 mr-2">Link Copied!</span>}
            <button
                onClick={() => handleTextToSpeech(note.content)}
                title={isSpeaking ? "Stop speaking" : "Read note aloud"}
                disabled={!note.content.trim()}
                className="p-2 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary disabled:opacity-50"
            >
                {isSpeaking ? <LoaderIcon className="w-5 h-5 animate-spin"/> : <Volume2Icon className="w-5 h-5" />}
            </button>
            <button 
                onClick={handleGenerateInsights} 
                disabled={isInsightsLoading}
                className="flex items-center px-3 py-2 bg-light-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                title="Generate summary and tags using AI"
            >
                {isInsightsLoading ? <Spinner /> : <SparklesIcon className="w-5 h-5 mr-2" />}
                Analyze Note
            </button>
        </div>
      </div>
      
       {insightsError && <div className="px-4 py-2 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-sm">{insightsError}</div>}

      <div className="flex-1 overflow-y-auto p-4">
        {isCapturing && (
             <div className="mb-4 relative">
                <video ref={videoRef} className={`w-full rounded-lg ${isCapturing === 'audio' ? 'hidden' : ''}`} autoPlay muted playsInline />
                <div className="absolute top-2 right-2 flex gap-2">
                    {isCapturing === 'camera' && <button onClick={handleCapturePhoto} className="px-4 py-2 bg-blue-500 text-white rounded-lg">Capture Photo</button>}
                    {isCapturing === 'audio' && <button onClick={stopRecording} className="px-4 py-2 bg-red-500 text-white rounded-lg">Stop Recording</button>}
                    <button onClick={stopMediaStreams} className="p-2 bg-gray-700/50 text-white rounded-full"><XCircleIcon className="w-5 h-5" /></button>
                </div>
                {isCapturing === 'audio' && <div className="p-4 text-center bg-dark-secondary rounded-lg">Recording audio...</div>}
            </div>
        )}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing..."
          className="w-full h-full bg-transparent focus:outline-none resize-none text-lg leading-relaxed min-h-[200px]"
        />
        
        {note.attachments.length > 0 && (
            <div className="mt-6">
                <h4 className="font-semibold mb-2">Attachments</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {note.attachments.map(att => <AttachmentPreview key={att.id} attachment={att} onRemove={removeAttachment} onAnalyze={handleAnalyzeAttachment} isAnalyzing={isAnalyzing === att.id}/>)}
                </div>
                {analysisError && <p className="text-sm text-red-500 mt-2">{analysisError}</p>}
            </div>
        )}

      </div>
      
      <div className="p-2 border-t border-light-primary dark:border-dark-primary flex items-center justify-between">
        <div className="flex items-center gap-1">
            <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary" title="Attach file">
                <PaperclipIcon className="w-5 h-5" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,audio/*,video/*" multiple />
            <button onClick={startCamera} className="p-2 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary" title="Capture photo">
                <CameraIcon className="w-5 h-5" />
            </button>
            <button onClick={isCapturing === 'audio' ? stopRecording : startRecording} className={`p-2 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary ${isCapturing === 'audio' ? 'text-red-500' : ''}`} title="Record audio">
                <MicIcon className="w-5 h-5" />
            </button>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{note.type === 'code' && note.language ? <LanguageBadge language={note.language} /> : `Type: ${note.type}`}</span>
            <span>Last updated: {new Date(note.updatedAt).toLocaleTimeString()}</span>
        </div>
      </div>
      <div className="p-4 border-t border-light-primary dark:border-dark-primary">
        {note.summary && <p className="text-sm italic mb-2 text-gray-600 dark:text-gray-400"><strong>Summary:</strong> {note.summary}</p>}
        <div className="flex flex-wrap gap-2">
            {note.tags.map(tag => <Tag key={tag} label={tag} />)}
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;