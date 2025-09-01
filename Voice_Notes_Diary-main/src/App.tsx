import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Play, Pause, Save, Trash2, Download, Search, Upload, Settings, Calendar, Clock, Volume2, FileText, Sparkles } from 'lucide-react';

interface DiaryEntry {
  id: string;
  timestamp: string;
  dateStr: string;
  timeStr: string;
  transcription: string;
  audioBlob: string;
  duration: number;
}

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlobs, setRecordedBlobs] = useState<Blob[]>([]);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [enableTranscription, setEnableTranscription] = useState(true);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingEntry, setPlayingEntry] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadEntries();
    setupSpeechRecognition();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const setupSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setCurrentTranscription(prev => prev + finalTranscript);
        }
      };
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true } 
      });

      setRecordedBlobs([]);
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          setRecordedBlobs(prev => [...prev, event.data]);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        setShowPreview(true);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      setCurrentTranscription('');

      if (enableTranscription && recognitionRef.current) {
        recognitionRef.current.start();
      }

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const saveEntry = async () => {
    if (recordedBlobs.length === 0) return;

    const now = new Date();
    const blob = new Blob(recordedBlobs, { type: 'audio/webm' });
    const audioBlob = await blobToBase64(blob);
    
    const entry: DiaryEntry = {
      id: Date.now().toString(),
      timestamp: now.toISOString(),
      dateStr: now.toLocaleDateString(),
      timeStr: now.toLocaleTimeString(),
      transcription: currentTranscription,
      audioBlob,
      duration: recordingTime
    };

    const newEntries = [entry, ...entries];
    setEntries(newEntries);
    localStorage.setItem('voiceDiaryEntries', JSON.stringify(newEntries));
    
    discardRecording();
  };

  const discardRecording = () => {
    setRecordedBlobs([]);
    setShowPreview(false);
    setCurrentTranscription('');
    setRecordingTime(0);
    if (previewAudioRef.current) {
      previewAudioRef.current.src = '';
    }
  };

  const deleteEntry = (entryId: string) => {
    const newEntries = entries.filter(entry => entry.id !== entryId);
    setEntries(newEntries);
    localStorage.setItem('voiceDiaryEntries', JSON.stringify(newEntries));
  };

  const loadEntries = () => {
    const stored = localStorage.getItem('voiceDiaryEntries');
    if (stored) {
      setEntries(JSON.parse(stored));
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredEntries = entries.filter(entry =>
    entry.transcription.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.dateStr.includes(searchTerm) ||
    entry.timeStr.includes(searchTerm)
  );

  useEffect(() => {
    if (showPreview && recordedBlobs.length > 0) {
      const blob = new Blob(recordedBlobs, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(blob);
      if (previewAudioRef.current) {
        previewAudioRef.current.src = audioUrl;
      }
    }
  }, [showPreview, recordedBlobs]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-pink-400/20 to-orange-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-indigo-400/10 to-cyan-400/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Voice Diary
            </h1>
          </div>
          <p className="text-xl text-slate-600 font-medium">Capture your thoughts, preserve your memories</p>
        </div>

        {/* Recording Section */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 mb-8 shadow-2xl border border-white/20">
          <div className="flex flex-col items-center space-y-6">
            {/* Recording Button */}
            <div className="relative">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`relative w-24 h-24 rounded-full transition-all duration-300 transform hover:scale-105 ${
                  isRecording 
                    ? 'bg-gradient-to-br from-red-500 to-pink-600 shadow-lg shadow-red-500/30 animate-pulse' 
                    : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40'
                }`}
              >
                {isRecording ? (
                  <MicOff className="w-10 h-10 text-white mx-auto" />
                ) : (
                  <Mic className="w-10 h-10 text-white mx-auto" />
                )}
                
                {isRecording && (
                  <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping"></div>
                )}
              </button>
              
              {isRecording && (
                <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
                  <div className="bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                    {formatTime(recordingTime)}
                  </div>
                </div>
              )}
            </div>

            <div className="text-center">
              <p className="text-lg font-semibold text-slate-700 mb-2">
                {isRecording ? 'Recording in progress...' : 'Ready to record'}
              </p>
              <p className="text-slate-500">
                {isRecording ? 'Click to stop recording' : 'Click the microphone to start'}
              </p>
            </div>

            {/* Transcription Toggle */}
            <div className="flex items-center space-x-3">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableTranscription}
                  onChange={(e) => setEnableTranscription(e.target.checked)}
                  className="sr-only"
                />
                <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                  enableTranscription ? 'bg-gradient-to-r from-indigo-500 to-purple-600' : 'bg-slate-300'
                }`}>
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${
                    enableTranscription ? 'transform translate-x-6' : ''
                  }`}></div>
                </div>
                <span className="ml-3 text-slate-700 font-medium">Speech-to-Text</span>
              </label>
            </div>

            {/* Live Transcription */}
            {currentTranscription && (
              <div className="w-full max-w-2xl bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <span className="font-semibold text-indigo-800">Live Transcription</span>
                </div>
                <p className="text-slate-700 italic leading-relaxed">{currentTranscription}</p>
              </div>
            )}
          </div>
        </div>

        {/* Preview Section */}
        {showPreview && (
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 mb-8 shadow-2xl border border-white/20">
            <div className="text-center space-y-6">
              <h3 className="text-2xl font-bold text-slate-800">Preview Recording</h3>
              
              <div className="max-w-md mx-auto">
                <audio
                  ref={previewAudioRef}
                  controls
                  className="w-full rounded-2xl shadow-lg"
                />
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={saveEntry}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                >
                  <Save className="w-5 h-5" />
                  Save Entry
                </button>
                <button
                  onClick={discardRecording}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                >
                  <Trash2 className="w-5 h-5" />
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Entries Section */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 space-y-4 lg:space-y-0">
            <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <Calendar className="w-8 h-8 text-indigo-600" />
              Diary Entries
              <span className="text-lg font-normal text-slate-500">({entries.length})</span>
            </h2>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search entries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-3 bg-white/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 w-64"
                />
              </div>
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mic className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-600 mb-2">No entries yet</h3>
              <p className="text-slate-500">Start recording to create your first diary entry!</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-gradient-to-r from-white to-slate-50 rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
                    <div className="flex items-center space-x-4 mb-4 lg:mb-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <Volume2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg">Entry #{entry.id.slice(-4)}</h4>
                        <div className="flex items-center space-x-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {entry.dateStr}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {entry.timeStr}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          const blob = base64ToBlob(entry.audioBlob, 'audio/webm');
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `diary_${entry.dateStr.replace(/\//g, '-')}_${entry.timeStr.replace(/:/g, '-')}.webm`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl transition-colors duration-300"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl transition-colors duration-300"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <audio
                      controls
                      className="w-full rounded-xl shadow-sm"
                      src={URL.createObjectURL(base64ToBlob(entry.audioBlob, 'audio/webm'))}
                    />
                  </div>

                  {entry.transcription && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span className="font-semibold text-indigo-800 text-sm">Transcription</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed italic">{entry.transcription}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;