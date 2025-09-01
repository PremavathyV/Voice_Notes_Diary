class VoiceDiary {
    constructor() {
        this.mediaRecorder = null;
        this.recordedBlobs = [];
        this.isRecording = false;
        this.recordingStartTime = null;
        this.timerInterval = null;
        this.recognition = null;
        this.currentTranscription = '';
        
        this.initializeElements();
        this.bindEvents();
        this.loadEntries();
        this.setupSpeechRecognition();
    }

    initializeElements() {
        this.recordBtn = document.getElementById('recordBtn');
        this.recordingIndicator = document.getElementById('recordingIndicator');
        this.recordingTimer = document.getElementById('recordingTimer');
        this.audioPreview = document.getElementById('audioPreview');
        this.previewAudio = document.getElementById('previewAudio');
        this.saveBtn = document.getElementById('saveBtn');
        this.discardBtn = document.getElementById('discardBtn');
        this.entriesList = document.getElementById('entriesList');
        this.searchInput = document.getElementById('searchInput');
        this.exportBtn = document.getElementById('exportBtn');
        this.importBtn = document.getElementById('importBtn');
        this.importInput = document.getElementById('importInput');
        this.enableTranscription = document.getElementById('enableTranscription');
        this.transcriptionResult = document.getElementById('transcriptionResult');
        this.modal = document.getElementById('modal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalBody = document.getElementById('modalBody');
        this.modalConfirm = document.getElementById('modalConfirm');
        this.modalCancel = document.getElementById('modalCancel');
        this.closeModal = document.getElementById('closeModal');
    }

    bindEvents() {
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.saveBtn.addEventListener('click', () => this.saveEntry());
        this.discardBtn.addEventListener('click', () => this.discardRecording());
        this.searchInput.addEventListener('input', (e) => this.searchEntries(e.target.value));
        this.exportBtn.addEventListener('click', () => this.exportEntries());
        this.importBtn.addEventListener('click', () => this.importInput.click());
        this.importInput.addEventListener('change', (e) => this.importEntries(e));
        this.closeModal.addEventListener('click', () => this.hideModal());
        this.modalCancel.addEventListener('click', () => this.hideModal());
        
        // Close modal when clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideModal();
            }
        });
    }

    setupSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                this.currentTranscription = finalTranscript || interimTranscript;
                this.updateTranscriptionDisplay(this.currentTranscription);
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
            };
        } else {
            console.warn('Speech recognition not supported in this browser');
            this.enableTranscription.disabled = true;
            this.enableTranscription.nextElementSibling.style.opacity = '0.5';
        }
    }

    updateTranscriptionDisplay(text) {
        if (text.trim()) {
            this.transcriptionResult.classList.remove('hidden');
            this.transcriptionResult.querySelector('.transcription-text').textContent = text;
        } else {
            this.transcriptionResult.classList.add('hidden');
        }
    }

    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                } 
            });

            this.recordedBlobs = [];
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.mediaRecorder.addEventListener('dataavailable', (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedBlobs.push(event.data);
                }
            });

            this.mediaRecorder.addEventListener('stop', () => {
                this.onRecordingStop();
                stream.getTracks().forEach(track => track.stop());
            });

            this.mediaRecorder.start(100); // Collect data every 100ms
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            this.recordBtn.textContent = '⏹️ Stop Recording';
            this.recordBtn.classList.add('recording');
            this.recordingIndicator.classList.remove('hidden');
            this.audioPreview.classList.add('hidden');
            this.currentTranscription = '';
            
            this.startTimer();
            
            if (this.enableTranscription.checked && this.recognition) {
                this.recognition.start();
            }

        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.showModal('Microphone Error', 
                'Unable to access microphone. Please ensure you have granted microphone permissions and try again.',
                false);
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            if (this.recognition) {
                this.recognition.stop();
            }
        }
    }

    onRecordingStop() {
        this.recordBtn.innerHTML = '<span class="btn-icon">🎙️</span><span class="btn-text">Start Recording</span>';
        this.recordBtn.classList.remove('recording');
        this.recordingIndicator.classList.add('hidden');
        this.stopTimer();

        if (this.recordedBlobs.length > 0) {
            const blob = new Blob(this.recordedBlobs, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(blob);
            
            this.previewAudio.src = audioUrl;
            this.audioPreview.classList.remove('hidden');
        }
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const seconds = Math.floor(elapsed / 1000) % 60;
            const minutes = Math.floor(elapsed / 60000);
            
            this.recordingTimer.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.recordingTimer.textContent = '00:00';
    }

    async saveEntry() {
        if (this.recordedBlobs.length === 0) {
            this.showModal('No Recording', 'There is no recording to save.', false);
            return;
        }

        const now = new Date();
        const timestamp = now.toISOString();
        const dateStr = now.toLocaleDateString();
        const timeStr = now.toLocaleTimeString();
        
        const entry = {
            id: Date.now().toString(),
            timestamp: timestamp,
            dateStr: dateStr,
            timeStr: timeStr,
            transcription: this.currentTranscription,
            audioBlob: await this.blobToBase64(new Blob(this.recordedBlobs, { type: 'audio/webm' }))
        };

        this.saveEntryToStorage(entry);
        this.addEntryToDOM(entry);
        this.discardRecording();
        this.currentTranscription = '';
        this.transcriptionResult.classList.add('hidden');

        this.showModal('Success', 'Voice note saved successfully!', false);
    }

    discardRecording() {
        this.recordedBlobs = [];
        this.audioPreview.classList.add('hidden');
        this.previewAudio.src = '';
        this.currentTranscription = '';
        this.transcriptionResult.classList.add('hidden');
    }

    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    saveEntryToStorage(entry) {
        const entries = this.getEntriesFromStorage();
        entries.unshift(entry);
        localStorage.setItem('voiceDiaryEntries', JSON.stringify(entries));
    }

    getEntriesFromStorage() {
        const stored = localStorage.getItem('voiceDiaryEntries');
        return stored ? JSON.parse(stored) : [];
    }

    loadEntries() {
        const entries = this.getEntriesFromStorage();
        this.renderEntries(entries);
    }

    renderEntries(entries) {
        if (entries.length === 0) {
            this.entriesList.innerHTML = `
                <div class="no-entries">
                    <p>No diary entries yet. Start recording to create your first entry!</p>
                </div>
            `;
            return;
        }

        this.entriesList.innerHTML = entries.map(entry => 
            this.createEntryHTML(entry)
        ).join('');

        // Bind audio controls
        entries.forEach(entry => {
            const audioElement = document.querySelector(`[data-entry-id="${entry.id}"] audio`);
            if (audioElement && entry.audioBlob) {
                const blob = this.base64ToBlob(entry.audioBlob, 'audio/webm');
                audioElement.src = URL.createObjectURL(blob);
            }
        });
    }

    createEntryHTML(entry) {
        return `
            <div class="entry-item" data-entry-id="${entry.id}">
                <div class="entry-header">
                    <div class="entry-title">Entry #${entry.id}</div>
                    <div class="entry-date">${entry.dateStr} at ${entry.timeStr}</div>
                </div>
                
                <audio class="entry-audio" controls>
                    Your browser does not support the audio element.
                </audio>
                
                ${entry.transcription ? `
                    <div class="entry-transcription">
                        <strong>Transcription:</strong> ${entry.transcription}
                    </div>
                ` : ''}
                
                <div class="entry-actions">
                    <button class="btn btn-secondary btn-small" onclick="diary.downloadEntry('${entry.id}')">
                        <span class="btn-icon">📥</span>
                        Download
                    </button>
                    <button class="btn btn-discard btn-small" onclick="diary.deleteEntry('${entry.id}')">
                        <span class="btn-icon">🗑️</span>
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    addEntryToDOM(entry) {
        const entries = this.getEntriesFromStorage();
        this.renderEntries(entries);
    }

    deleteEntry(entryId) {
        this.showModal('Confirm Delete', 
            'Are you sure you want to delete this diary entry? This action cannot be undone.',
            true,
            () => {
                const entries = this.getEntriesFromStorage().filter(entry => entry.id !== entryId);
                localStorage.setItem('voiceDiaryEntries', JSON.stringify(entries));
                this.renderEntries(entries);
                this.hideModal();
            }
        );
    }

    downloadEntry(entryId) {
        const entries = this.getEntriesFromStorage();
        const entry = entries.find(e => e.id === entryId);
        
        if (entry && entry.audioBlob) {
            const blob = this.base64ToBlob(entry.audioBlob, 'audio/webm');
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `diary_${entry.dateStr.replace(/\//g, '-')}_${entry.timeStr.replace(/:/g, '-')}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
        }
    }

    searchEntries(searchTerm) {
        const entries = this.getEntriesFromStorage();
        const filteredEntries = entries.filter(entry => 
            entry.transcription.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.dateStr.includes(searchTerm) ||
            entry.timeStr.includes(searchTerm)
        );
        
        this.renderEntries(filteredEntries);
    }

    exportEntries() {
        const entries = this.getEntriesFromStorage();
        const dataStr = JSON.stringify(entries, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voice_diary_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    async importEntries(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importedEntries = JSON.parse(text);
            
            if (!Array.isArray(importedEntries)) {
                throw new Error('Invalid file format');
            }

            this.showModal('Confirm Import', 
                `This will import ${importedEntries.length} entries. Existing entries will be preserved. Continue?`,
                true,
                () => {
                    const existingEntries = this.getEntriesFromStorage();
                    const mergedEntries = [...importedEntries, ...existingEntries];
                    
                    // Remove duplicates based on ID
                    const uniqueEntries = mergedEntries.filter((entry, index, self) => 
                        index === self.findIndex(e => e.id === entry.id)
                    );
                    
                    localStorage.setItem('voiceDiaryEntries', JSON.stringify(uniqueEntries));
                    this.renderEntries(uniqueEntries);
                    this.hideModal();
                    
                    this.showModal('Success', `Successfully imported ${importedEntries.length} entries!`, false);
                }
            );
            
        } catch (error) {
            this.showModal('Import Error', 'Failed to import entries. Please check the file format.', false);
        }
        
        // Reset file input
        event.target.value = '';
    }

    showModal(title, message, showConfirm = false, onConfirm = null) {
        this.modalTitle.textContent = title;
        this.modalBody.innerHTML = `<p>${message}</p>`;
        
        if (showConfirm) {
            this.modalConfirm.classList.remove('hidden');
            this.modalConfirm.onclick = onConfirm;
        } else {
            this.modalConfirm.classList.add('hidden');
        }
        
        this.modal.classList.remove('hidden');
    }

    hideModal() {
        this.modal.classList.add('hidden');
        this.modalConfirm.onclick = null;
    }
}

// Initialize the diary when the page loads
const diary = new VoiceDiary();

// Make diary available globally for onclick handlers
window.diary = diary;